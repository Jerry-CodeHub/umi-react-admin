import type { AlarmLevel, AlarmType, DashboardOverview, RegionKey, Ticket } from '@/services/types';
import { REGIONS } from '../catalog';
import { ALARM_WINDOW_DAYS, DAY, addDays, startOfDay, type Dataset } from '../generate';

const LEVELS: AlarmLevel[] = ['critical', 'major', 'minor', 'info'];
const TYPES: AlarmType[] = ['interference', 'signal', 'link', 'offline', 'power', 'temperature'];

const time = (value: string) => new Date(value).getTime();
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** 工作台汇总：全部由明细聚合，口径与 generate.test.ts 的断言一致 */
export const buildOverview = (data: Dataset, now: Date): DashboardOverview => {
  const nowMs = now.getTime();
  const today = startOfDay(now);
  const todayMs = today.getTime();
  const { devices, alarms, tickets } = data;

  // ---- KPI ----
  const devicesOnline = devices.filter((d) => d.status === 'online').length;
  const alarmsToday = alarms.filter((a) => time(a.occurredAt) >= todayMs && time(a.occurredAt) <= nowMs).length;
  const yesterdayMs = addDays(today, -1).getTime();
  const alarmsYesterdaySamePeriod = alarms.filter(
    (a) => time(a.occurredAt) >= yesterdayMs && time(a.occurredAt) <= yesterdayMs + (nowMs - todayMs),
  ).length;
  const alarms7d = Array.from({ length: 7 }, (_, i) => {
    const from = addDays(today, i - 6).getTime();
    const to = addDays(today, i - 5).getTime();
    return alarms.filter((a) => time(a.occurredAt) >= from && time(a.occurredAt) < to).length;
  });

  const faultDone = (fromDays: number, toDays: number) =>
    tickets.filter(
      (t): t is Ticket & { resolvedAt: string; respondedAt: string } =>
        t.kind === 'fault' &&
        !!t.resolvedAt &&
        !!t.respondedAt &&
        time(t.resolvedAt) <= nowMs - fromDays * DAY &&
        time(t.resolvedAt) > nowMs - toDays * DAY,
    );
  const slaRateOf = (list: ReturnType<typeof faultDone>) =>
    list.length
      ? list.filter((t) => time(t.resolvedAt) - time(t.createdAt) <= t.slaHours * 3_600_000).length / list.length
      : 1;
  const avgResponseOf = (list: ReturnType<typeof faultDone>) =>
    list.length
      ? list.reduce((sum, t) => sum + (time(t.respondedAt) - time(t.createdAt)) / 60_000, 0) / list.length
      : 0;
  const recent = faultDone(0, 30);
  const previous = faultDone(30, 60);

  // ---- 近 90 天趋势（按级别） ----
  const trendStart = addDays(today, -(ALARM_WINDOW_DAYS - 1)).getTime();
  const trend = new Map<string, number>();
  alarms.forEach((a) => {
    const at = new Date(a.occurredAt);
    if (at.getTime() < trendStart) return;
    const key = `${localDate(at)}|${a.level}`;
    trend.set(key, (trend.get(key) ?? 0) + 1);
  });
  const alarmTrend = Array.from({ length: ALARM_WINDOW_DAYS }, (_, i) =>
    localDate(addDays(today, i - ALARM_WINDOW_DAYS + 1)),
  ).flatMap((date) => LEVELS.map((level) => ({ date, level, count: trend.get(`${date}|${level}`) ?? 0 })));

  // ---- 近 30 天：类型、处置流向 ----
  const since30 = nowMs - 30 * DAY;
  const alarms30 = alarms.filter((a) => time(a.occurredAt) > since30);
  const alarmTypes = TYPES.map((type) => ({ type, count: alarms30.filter((a) => a.type === type).length }));

  const flows = new Map<string, number>();
  const addFlow = (source: string, target: string) => {
    const key = `${source}→${target}`;
    flows.set(key, (flows.get(key) ?? 0) + 1);
  };
  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  alarms30.forEach((a) => {
    const disposition = a.status === 'active' ? 'pending' : a.status;
    addFlow(`level:${a.level}`, `disposition:${disposition}`);
    if (a.status === 'ticketed') {
      const ticket = a.ticketId ? ticketById.get(a.ticketId) : undefined;
      const result = !ticket?.resolvedAt
        ? 'inProgress'
        : time(ticket.resolvedAt) - time(ticket.createdAt) <= ticket.slaHours * 3_600_000
          ? 'inSla'
          : 'overdue';
      addFlow('disposition:ticketed', `result:${result}`);
    }
  });
  const disposition = [...flows.entries()].map(([key, value]) => {
    const [source, target] = key.split('→');
    return { source, target, value };
  });

  // ---- 大区在线率、设备健康、大区 → 城市 ----
  const regionOnline = REGIONS.map((region: RegionKey) => {
    const list = devices.filter((d) => d.region === region);
    return { region, online: list.filter((d) => d.status === 'online').length, total: list.length };
  });
  const alarmCount30 = new Map<string, number>();
  alarms30.forEach((a) => alarmCount30.set(a.deviceId, (alarmCount30.get(a.deviceId) ?? 0) + 1));
  const deviceHealth = devices.map((d) => ({
    id: d.id,
    name: d.name,
    region: d.region,
    uptime30d: d.uptime30d,
    alarms30d: alarmCount30.get(d.id) ?? 0,
  }));
  const regionTree = REGIONS.map((region) => {
    const cities = new Map<string, number>();
    devices.filter((d) => d.region === region).forEach((d) => cities.set(d.city, (cities.get(d.city) ?? 0) + 1));
    return { region, cities: [...cities.entries()].map(([city, count]) => ({ city, count })) };
  });

  // ---- 最新动态：重要告警、工单新建与完成 ----
  const activities: DashboardOverview['activities'] = [
    ...alarms
      .filter((a) => a.level === 'critical' || a.level === 'major')
      .slice(0, 20)
      .map((a) => ({
        id: a.id,
        kind: 'alarm' as const,
        level: a.level,
        alarmType: a.type,
        deviceName: a.deviceName,
        at: a.occurredAt,
      })),
    ...tickets.slice(0, 20).map((t) => ({
      id: `${t.id}:created`,
      kind: 'ticketCreated' as const,
      deviceName: t.deviceName,
      ticketId: t.id,
      assigneeName: t.assigneeName,
      at: t.createdAt,
    })),
    ...tickets
      .filter((t): t is Ticket & { resolvedAt: string } => !!t.resolvedAt)
      .sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt))
      .slice(0, 20)
      .map((t) => ({
        id: `${t.id}:done`,
        kind: 'ticketDone' as const,
        deviceName: t.deviceName,
        ticketId: t.id,
        assigneeName: t.assigneeName,
        at: t.resolvedAt,
      })),
  ]
    .filter((item) => time(item.at) <= nowMs)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  return {
    generatedAt: now.toISOString(),
    kpi: {
      devicesTotal: devices.length,
      devicesOnline,
      alarmsToday,
      alarmsYesterdaySamePeriod,
      alarms7d,
      slaRate: slaRateOf(recent),
      slaRatePrev: slaRateOf(previous),
      avgResponseMinutes: Math.round(avgResponseOf(recent)),
      avgResponseMinutesPrev: Math.round(avgResponseOf(previous)),
    },
    alarmTrend,
    alarmTypes,
    regionOnline,
    disposition,
    deviceHealth,
    regionTree,
    activities,
  };
};
