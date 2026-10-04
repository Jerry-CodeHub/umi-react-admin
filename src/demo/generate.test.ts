/**
 * 演示数据「合理性」门禁：方案 4.2 的规则逐条断言。改生成器导致数据不合理时，这里先失败。
 */
import { describe, expect, it } from 'vitest';
import { CITIES } from './catalog';
import { ALARM_WINDOW_DAYS, DAY, DEVICE_TOTAL, addDays, generateDataset, startOfDay } from './generate';
import { buildOverview } from './server/dashboard';

// 固定在一个工作日的晚上，覆盖「今天已过去大半」的情形
const NOW = new Date(2026, 8, 23, 20, 15);
const data = generateDataset({ now: NOW });
const t = (value: string) => new Date(value).getTime();
const ratio = (part: number, whole: number) => part / whole;

describe('确定性与时间滑动', () => {
  it('同一时刻两次生成逐字节一致', () => {
    expect(JSON.stringify(generateDataset({ now: NOW }))).toBe(JSON.stringify(data));
  });

  it('按日播种：明天再生成，昨天及以前的告警 ID 与发生时间不变', () => {
    const tomorrow = generateDataset({ now: new Date(NOW.getTime() + DAY) });
    const cutoff = startOfDay(NOW).getTime();
    const before = (list: typeof data.alarms) =>
      list
        .filter((a) => !a.id.startsWith('ALM-LIVE') && t(a.occurredAt) < cutoff && t(a.occurredAt) > cutoff - 60 * DAY)
        .map((a) => `${a.id}@${a.occurredAt}`);
    expect(before(tomorrow.alarms)).toEqual(before(data.alarms));
  });

  it('数据里没有「未来」的告警、工单与日志', () => {
    const now = NOW.getTime();
    expect(data.alarms.every((a) => t(a.occurredAt) <= now)).toBe(true);
    expect(data.tickets.every((x) => t(x.createdAt) <= now)).toBe(true);
    expect(data.logs.every((l) => t(l.createdAt) <= now)).toBe(true);
    expect(data.users.every((u) => !u.lastLoginAt || t(u.lastLoginAt) <= now)).toBe(true);
  });

  it('告警窗口为近 90 天', () => {
    const earliest = Math.min(...data.alarms.filter((a) => !a.id.startsWith('ALM-LIVE')).map((a) => t(a.occurredAt)));
    expect(earliest).toBeGreaterThanOrEqual(addDays(startOfDay(NOW), -(ALARM_WINDOW_DAYS - 1)).getTime());
  });
});

describe('用户', () => {
  it('86 人，ID、登录名、邮箱唯一', () => {
    expect(data.users).toHaveLength(86);
    for (const key of ['id', 'username', 'email'] as const) {
      expect(new Set(data.users.map((u) => u[key])).size).toBe(86);
    }
  });

  it('邮箱只用 example.com，手机号只以脱敏形式出现', () => {
    expect(data.users.every((u) => u.email.endsWith('@example.com'))).toBe(true);
    expect(data.users.every((u) => /^1\d{2}\*{4}\d{4}$/.test(u.phone))).toBe(true);
  });

  it('不生成与知名人物同名的姓名', () => {
    const famous = ['马云', '王菲', '李娜', '刘翔', '姚明', '李宁', '雷军'];
    expect(data.users.filter((u) => famous.includes(u.name))).toEqual([]);
  });

  it('体验账号 admin / guest 存在且为启用状态，角色分别是管理员与访客', () => {
    const admin = data.users.find((u) => u.username === 'admin');
    const guest = data.users.find((u) => u.username === 'guest');
    expect(admin).toMatchObject({ role: 'admin', status: 'active' });
    expect(guest).toMatchObject({ role: 'viewer', status: 'active' });
  });

  it('状态比例：约九成正常，停用与锁定是少数', () => {
    const active = data.users.filter((u) => u.status === 'active').length;
    expect(ratio(active, 86)).toBeGreaterThan(0.85);
    expect(ratio(active, 86)).toBeLessThan(0.95);
  });
});

describe('设备', () => {
  it(`${DEVICE_TOTAL} 台，每个城市至少 2 台，一线城市多于西北城市`, () => {
    expect(data.devices).toHaveLength(DEVICE_TOTAL);
    const byCity = new Map<string, number>();
    data.devices.forEach((d) => byCity.set(d.city, (byCity.get(d.city) ?? 0) + 1));
    expect(Math.min(...byCity.values())).toBeGreaterThanOrEqual(2);
    expect(byCity.get('上海')!).toBeGreaterThan(byCity.get('银川')!);
  });

  it('坐标落在所属城市附近（±0.4°）', () => {
    data.devices.forEach((d) => {
      const city = CITIES.find((c) => c.zh === d.city)!;
      expect(Math.abs(d.lng - city.lng)).toBeLessThanOrEqual(0.4);
      expect(Math.abs(d.lat - city.lat)).toBeLessThanOrEqual(0.4);
    });
  });

  it('在线率 90%~97%，数值范围合理', () => {
    const online = data.devices.filter((d) => d.status === 'online').length;
    expect(ratio(online, DEVICE_TOTAL)).toBeGreaterThan(0.9);
    expect(ratio(online, DEVICE_TOTAL)).toBeLessThan(0.97);
    expect(data.devices.every((d) => d.uptime30d > 0 && d.uptime30d <= 100)).toBe(true);
    expect(data.devices.every((d) => d.signalDbm <= -45 && d.signalDbm >= -100)).toBe(true);
    expect(data.devices.every((d) => d.band[0] < d.band[1])).toBe(true);
  });

  it('每台离线 / 故障设备都有一条未恢复的告警与之对应', () => {
    const activeByDevice = new Set(data.alarms.filter((a) => a.status === 'active').map((a) => a.deviceId));
    data.devices.filter((d) => d.status !== 'online').forEach((d) => expect(activeByDevice.has(d.id)).toBe(true));
  });
});

describe('告警', () => {
  const regular = data.alarms.filter((a) => !a.id.startsWith('ALM-LIVE'));

  it('级别比例：严重最少，一般 / 提示占多数', () => {
    const share = (level: string) => ratio(regular.filter((a) => a.level === level).length, regular.length);
    expect(share('critical')).toBeGreaterThan(0.02);
    expect(share('critical')).toBeLessThan(0.1);
    expect(share('major')).toBeLessThan(0.3);
    expect(share('minor') + share('info')).toBeGreaterThan(0.6);
  });

  it('工作日平均告警量明显高于周末', () => {
    const byDay = new Map<string, { count: number; weekend: boolean }>();
    regular.forEach((a) => {
      const date = new Date(a.occurredAt);
      const key = startOfDay(date).toDateString();
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      byDay.set(key, { count: (byDay.get(key)?.count ?? 0) + 1, weekend });
    });
    const today = startOfDay(NOW).toDateString();
    const days = [...byDay.entries()].filter(([key]) => key !== today).map(([, v]) => v);
    const avg = (list: typeof days) => list.reduce((s, d) => s + d.count, 0) / list.length;
    expect(avg(days.filter((d) => !d.weekend))).toBeGreaterThan(avg(days.filter((d) => d.weekend)) * 1.3);
  });

  it('恢复时间晚于发生时间；已转工单的告警都能找到对应工单', () => {
    const tickets = new Set(data.tickets.map((x) => x.id));
    const violations = data.alarms.filter(
      (a) =>
        (a.recoveredAt && t(a.recoveredAt) <= t(a.occurredAt)) ||
        (a.status === 'ticketed' && !tickets.has(a.ticketId!)) ||
        (a.status === 'active' && a.recoveredAt),
    );
    expect(violations).toEqual([]);
  });
});

describe('工单', () => {
  it('时间线有序：创建 ≤ 响应 ≤ 完成，状态与时间字段一致', () => {
    const violations = data.tickets.filter(
      (x) =>
        (x.status === 'todo' && (x.respondedAt || x.resolvedAt)) ||
        (x.status === 'doing' && (!x.respondedAt || x.resolvedAt)) ||
        (x.status === 'done' && (!x.respondedAt || !x.resolvedAt)) ||
        (x.respondedAt && t(x.respondedAt) < t(x.createdAt)) ||
        (x.resolvedAt && t(x.resolvedAt) <= t(x.respondedAt!)),
    );
    expect(violations).toEqual([]);
  });

  it('故障工单晚于告警发生；处理人来自负责该大区的运维部门', () => {
    const alarms = new Map(data.alarms.map((a) => [a.id, a]));
    const users = new Map(data.users.map((u) => [u.id, u]));
    data.tickets
      .filter((x) => x.kind === 'fault')
      .forEach((x) => {
        const alarm = alarms.get(x.alarmId!)!;
        expect(t(x.createdAt)).toBeGreaterThanOrEqual(t(alarm.occurredAt));
        expect(['operator', 'lead']).toContain(users.get(x.assigneeId)!.role);
      });
  });

  it('看板有料：待处理、处理中、近 3 天完成都不为空', () => {
    const since = NOW.getTime() - 3 * DAY;
    expect(data.tickets.filter((x) => x.status === 'todo').length).toBeGreaterThan(0);
    expect(data.tickets.filter((x) => x.status === 'doing').length).toBeGreaterThan(0);
    expect(data.tickets.filter((x) => x.resolvedAt && t(x.resolvedAt) > since).length).toBeGreaterThan(5);
  });
});

describe('日志与日程', () => {
  it('日志 IP 全部取自 RFC 5737 文档保留网段', () => {
    expect(data.logs.every((l) => /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$/.test(l.ip))).toBe(true);
  });

  it('派单由值班长操作、结单由工单处理人操作', () => {
    const tickets = new Map(data.tickets.map((x) => [x.id, x]));
    const roles = new Map(data.users.map((u) => [u.id, u.role]));
    data.logs
      .filter((l) => l.action === 'ticketClose')
      .forEach((l) => expect(l.actorId).toBe(tickets.get(l.target)?.assigneeId));
    data.logs.filter((l) => l.action === 'ticketAssign').forEach((l) => expect(roles.get(l.actorId)).toBe('lead'));
  });

  it('同一条告警 / 工单的同一种操作只记一次日志', () => {
    const keys = data.logs
      .filter((l) => l.action === 'alarmHandle' || l.action.startsWith('ticket'))
      .map((l) => `${l.action}:${l.target}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('日程覆盖前后五周，每周都有值班交接', () => {
    expect(data.events.filter((e) => e.type === 'duty').length).toBeGreaterThanOrEqual(9);
    expect(new Set(data.events.map((e) => e.id)).size).toBe(data.events.length);
  });
});

describe('工作台口径', () => {
  const overview = buildOverview(data, NOW);

  it('KPI 由明细聚合：在线设备数、今日告警数与明细一致', () => {
    expect(overview.kpi.devicesOnline).toBe(data.devices.filter((d) => d.status === 'online').length);
    const todayStart = startOfDay(NOW).getTime();
    expect(overview.kpi.alarmsToday).toBe(data.alarms.filter((a) => t(a.occurredAt) >= todayStart).length);
    expect(overview.kpi.alarms7d[6]).toBe(overview.kpi.alarmsToday);
  });

  it('时限达成率与平均响应落在合理区间', () => {
    expect(overview.kpi.slaRate).toBeGreaterThan(0.8);
    expect(overview.kpi.slaRate).toBeLessThanOrEqual(1);
    expect(overview.kpi.avgResponseMinutes).toBeGreaterThan(10);
    expect(overview.kpi.avgResponseMinutes).toBeLessThan(180);
  });

  it('趋势覆盖 90 天 × 4 个级别，总量与窗口内告警一致', () => {
    expect(overview.alarmTrend).toHaveLength(ALARM_WINDOW_DAYS * 4);
    const total = overview.alarmTrend.reduce((s, r) => s + r.count, 0);
    const start = addDays(startOfDay(NOW), -(ALARM_WINDOW_DAYS - 1)).getTime();
    expect(total).toBe(data.alarms.filter((a) => t(a.occurredAt) >= start).length);
  });

  it('大区设备数合计等于设备总数', () => {
    expect(overview.regionOnline.reduce((s, r) => s + r.total, 0)).toBe(DEVICE_TOTAL);
    expect(overview.regionTree.flatMap((r) => r.cities).reduce((s, c) => s + c.count, 0)).toBe(DEVICE_TOTAL);
  });
});

describe('英文数据', () => {
  it('同一种子生成同构的英文数据（专有名词为英文）', () => {
    const en = generateDataset({ now: NOW, locale: 'en-US' });
    expect(en.users.map((u) => u.id)).toEqual(data.users.map((u) => u.id));
    expect(en.alarms.map((a) => a.id)).toEqual(data.alarms.map((a) => a.id));
    expect(en.devices.every((d) => !/[一-龥]/.test(d.name + d.city))).toBe(true);
    expect(en.users.every((u) => !/[一-龥]/.test(u.name))).toBe(true);
  });
});
