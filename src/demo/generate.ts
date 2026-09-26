/**
 * 演示数据生成器：一个虚构的「物联网监测运营平台」。
 *
 * 设计要点（合理性规则由 generate.test.ts 逐条断言）：
 * - 按日播种：告警、工单、日志、日程都以「日历日」为单位取子随机流（种子含日期），
 *   所以每一天的历史是固定的——窗口随今天滑动，昨天的数据明天还是同一批，ID 稳定。
 * - 状态随时间演进：工单的响应、完成时刻在生成时就确定，状态按「现在」推导
 *   （未到响应时刻为待处理、已响应未完成为处理中），看板和 KPI 会随一天的推移自然变化。
 * - 口径自洽：设备状态与活动告警对应；告警的处置方式决定是否派生工单；
 *   工作台 KPI 由这些明细聚合，不单独写死。
 * - 隐私：邮箱只用 example.com；手机号只生成脱敏形式；IP 取文档保留段（RFC 5737）。
 */
import { DEFAULT_ROLE_PERMISSIONS, ROLE_KEYS } from '@/constants/permissions';
import type {
  Alarm,
  AlarmLevel,
  AlarmSource,
  AlarmType,
  CalendarEvent,
  Device,
  DeviceStatus,
  EventType,
  LogAction,
  OperationLog,
  RoleKey,
  Ticket,
  TicketPriority,
  User,
  UserStatus,
} from '@/services/types';
import {
  CITIES,
  DEPARTMENTS,
  DEVICE_MODELS,
  EVENT_TITLES,
  FIRMWARES,
  GIVEN_NAMES,
  REGIONS,
  REGION_OWNER,
  REPORT_NAMES,
  ROLE_NAMES,
  SURNAMES,
  TICKET_TITLES,
  USER_AGENTS,
  deviceName,
  type City,
} from './catalog';
import { allocate, createRng, type Rng } from './random';

export type DemoLocale = 'zh-CN' | 'en-US';

export const SEED = 'umi-react-admin/demo/v1';
export const DEVICE_TOTAL = 240;
export const ALARM_WINDOW_DAYS = 90;
export const LOG_WINDOW_DAYS = 30;
export const EVENT_WINDOW_DAYS = 35;

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const SLA_HOURS: Record<TicketPriority | 'maintenance', number> = {
  P1: 4,
  P2: 12,
  P3: 48,
  maintenance: 14 * 24,
};

/** 本地时区的日历日工具（演示数据按访客所在时区组织「今天」） */
export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
export const dateKey = (date: Date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
const iso = (ms: number) => new Date(ms).toISOString();
const round1 = (value: number) => Math.round(value * 10) / 10;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** 一天 24 小时的活动强度（运维告警与操作都集中在白天） */
const HOUR_WEIGHTS = [2, 1, 1, 1, 1, 2, 3, 5, 8, 10, 10, 10, 8, 9, 10, 10, 10, 9, 8, 7, 6, 5, 4, 3];
const pickMinuteOfDay = (rng: Rng) => rng.weighted([...HOUR_WEIGHTS.keys()], HOUR_WEIGHTS) * 60 + rng.int(0, 59);

/** RFC 5737 文档保留网段 */
const pickIp = (rng: Rng) => `${rng.pick(['192.0.2', '198.51.100', '203.0.113'])}.${rng.int(2, 254)}`;

const ALARM_TYPES: AlarmType[] = ['interference', 'signal', 'link', 'offline', 'power', 'temperature'];
const ALARM_TYPE_WEIGHTS = [28, 24, 16, 14, 10, 8];
const LEVELS: AlarmLevel[] = ['critical', 'major', 'minor', 'info'];
/** 各类型告警的级别分布（合计约 严重 5% / 重要 18% / 一般 43% / 提示 34%） */
const LEVEL_WEIGHTS_BY_TYPE: Record<AlarmType, number[]> = {
  interference: [3, 17, 50, 30],
  signal: [1, 8, 36, 55],
  link: [6, 24, 45, 25],
  offline: [12, 30, 38, 20],
  power: [10, 25, 40, 25],
  temperature: [4, 16, 45, 35],
};
type Disposition = 'ticket' | 'recover' | 'falsePositive';
const DISPOSITIONS: Disposition[] = ['ticket', 'recover', 'falsePositive'];
/** 级别越高越倾向转工单 */
const DISPOSITION_WEIGHTS: Record<AlarmLevel, number[]> = {
  critical: [85, 10, 5],
  major: [55, 35, 10],
  minor: [15, 70, 15],
  info: [3, 80, 17],
};
const PRIORITY_BY_LEVEL: Record<AlarmLevel, TicketPriority> = { critical: 'P1', major: 'P2', minor: 'P3', info: 'P3' };
/** 响应、处理时长中位数（分钟），对数正态分布 */
const RESPOND_MEDIAN: Record<TicketPriority, number> = { P1: 10, P2: 25, P3: 60 };
const RESOLVE_MEDIAN: Record<TicketPriority, number> = { P1: 100, P2: 280, P3: 900 };

export interface Dataset {
  now: string;
  locale: DemoLocale;
  users: User[];
  roles: { id: RoleKey; permissions: string[]; updatedAt: string }[];
  devices: Device[];
  alarms: Alarm[];
  tickets: Ticket[];
  logs: OperationLog[];
  events: CalendarEvent[];
}

// ---------------------------------------------------------------- 用户

const USER_STATUS_COUNTS: [UserStatus, number][] = [
  ['disabled', 6],
  ['locked', 2],
];

const generateUsers = (locale: DemoLocale, now: Date): User[] => {
  const rng = createRng(`${SEED}:users`);
  const usedNames = new Set<string>();
  const usedUsernames = new Set<string>();
  const joinedFrom = new Date(2021, 5, 1).getTime();
  const joinedTo = Math.min(new Date(2026, 7, 31).getTime(), now.getTime() - 7 * DAY);

  const drafts = DEPARTMENTS.flatMap((dept) => {
    const roles = rng.shuffle(dept.roles.flatMap(([role, count]) => Array.from({ length: count }, () => role)));
    return roles.map((role) => {
      let surname: (typeof SURNAMES)[number];
      let given: (typeof GIVEN_NAMES)[number];
      do {
        surname = rng.weighted(
          SURNAMES,
          SURNAMES.map((s) => s[2]),
        );
        given = rng.pick(GIVEN_NAMES);
      } while (usedNames.has(surname[0] + given[0]));
      usedNames.add(surname[0] + given[0]);

      let username = `${given[1]}.${surname[1]}`;
      for (let n = 2; usedUsernames.has(username); n++) {
        username = `${given[1]}.${surname[1]}${n}`;
      }
      usedUsernames.add(username);

      return {
        department: dept.key,
        role,
        name: locale === 'en-US' ? `${capitalize(given[1])} ${capitalize(surname[1])}` : surname[0] + given[0],
        username,
        createdAt: joinedFrom + rng.next() * (joinedTo - joinedFrom),
        phone: `1${rng.pick(['3', '5', '8'])}${rng.int(0, 9)}****${String(rng.int(0, 9999)).padStart(4, '0')}`,
        loginMinutesAgo: Math.min(rng.logNormal(600, 1.3), 30 * 24 * 60),
        ip: pickIp(rng),
      };
    });
  });

  // 工号按入职先后编排
  drafts.sort((a, b) => a.createdAt - b.createdAt);
  const users: User[] = drafts.map((draft, index) => ({
    id: `U${1001 + index}`,
    username: draft.username,
    name: draft.name,
    email: `${draft.username}@example.com`,
    phone: draft.phone,
    department: draft.department,
    role: draft.role,
    status: 'active',
    createdAt: iso(draft.createdAt),
    lastLoginAt: iso(Math.max(draft.createdAt, now.getTime() - draft.loginMinutesAgo * MINUTE)),
    lastLoginIp: draft.ip,
  }));

  // 体验账号：admin（系统管理员）与 guest（访客），登录页一键体验使用
  const admin = users.find((u) => u.department === 'platform' && u.role === 'admin')!;
  Object.assign(admin, { username: 'admin', email: 'admin@example.com' });
  const guest = users.find((u) => u.department === 'support' && u.role === 'viewer')!;
  Object.assign(guest, { username: 'guest', email: 'guest@example.com' });

  // 停用 / 锁定账号（体验账号除外）
  const candidates = rng.shuffle(users.filter((u) => u !== admin && u !== guest));
  let cursor = 0;
  USER_STATUS_COUNTS.forEach(([status, count]) => {
    for (let i = 0; i < count; i++, cursor++) {
      const user = candidates[cursor];
      user.status = status;
      const created = new Date(user.createdAt).getTime();
      const daysAgo = status === 'disabled' ? rng.int(40, 300) : rng.int(1, 10);
      user.lastLoginAt = iso(Math.max(created, now.getTime() - daysAgo * DAY - rng.int(0, 600) * MINUTE));
    }
  });
  return users;
};

// ---------------------------------------------------------------- 设备

const generateDevices = (locale: DemoLocale, now: Date): Device[] => {
  const counts = allocate(
    CITIES.map((c) => c.weight),
    DEVICE_TOTAL,
    2,
  );
  const installFrom = new Date(2021, 2, 1).getTime();
  return CITIES.flatMap((city, cityIndex) =>
    Array.from({ length: counts[cityIndex] }, (_, i) => {
      const seq = i + 1;
      const rng = createRng(`${SEED}:device:${city.code}:${seq}`);
      const spec = rng.weighted(
        DEVICE_MODELS,
        DEVICE_MODELS.map((m) => m.weight),
      );
      const status = rng.weighted<DeviceStatus>(['online', 'offline', 'fault'], [93, 4, 3]);
      const uptime =
        status === 'online'
          ? rng.normal(99.3, 0.5, 96.5, 100)
          : status === 'fault'
            ? rng.normal(94, 2, 88, 98)
            : rng.normal(86, 4, 72, 94);
      // 故障设备仍在上报心跳（只是有未恢复的故障告警）；离线设备的心跳停在离线那一刻
      const heartbeatAgo =
        status === 'offline'
          ? Math.min(Math.max(rng.logNormal(30 * 60, 1), 30), 5 * 24 * 60) * MINUTE
          : rng.int(5, 290) * 1000;
      const installed = Math.min(installFrom + rng.int(0, 1900) * DAY, now.getTime() - 30 * DAY);
      return {
        id: `DEV-${city.code}-${String(seq).padStart(2, '0')}`,
        name: deviceName(city, seq, locale),
        region: city.region,
        city: locale === 'en-US' ? city.en : city.zh,
        lng: Math.round((city.lng + rng.normal(0, 0.12, -0.35, 0.35)) * 10000) / 10000,
        lat: Math.round((city.lat + rng.normal(0, 0.1, -0.3, 0.3)) * 10000) / 10000,
        model: spec.model,
        band: spec.band,
        status,
        firmware: rng.weighted(FIRMWARES, [10, 20, 35, 35]),
        installedAt: iso(installed),
        lastHeartbeatAt: iso(now.getTime() - heartbeatAgo),
        uptime30d: round1(uptime),
        signalDbm: Math.round(status === 'online' ? rng.normal(-68, 7, -95, -45) : rng.normal(-84, 5, -100, -65)),
      } satisfies Device;
    }),
  );
};

// ---------------------------------------------------------------- 告警与工单

type TicketTiming = { createdAt: number; respondedAt: number; resolvedAt: number };

/** 按「现在」推导工单状态：未到响应时刻为待处理，已响应未完成为处理中 */
const ticketState = (timing: TicketTiming, now: number): Pick<Ticket, 'status' | 'respondedAt' | 'resolvedAt'> => {
  if (timing.resolvedAt <= now) {
    return { status: 'done', respondedAt: iso(timing.respondedAt), resolvedAt: iso(timing.resolvedAt) };
  }
  if (timing.respondedAt <= now) {
    return { status: 'doing', respondedAt: iso(timing.respondedAt) };
  }
  return { status: 'todo' };
};

const ticketTitle = (device: Device, key: keyof typeof TICKET_TITLES, locale: DemoLocale) =>
  `${device.name} · ${TICKET_TITLES[key][locale === 'en-US' ? 'en' : 'zh']}`;

const generateAlarmsAndTickets = (locale: DemoLocale, now: Date, devices: Device[], users: User[]) => {
  const nowMs = now.getTime();
  const today = startOfDay(now);
  const alarms: Alarm[] = [];
  const tickets: Ticket[] = [];
  const deviceWeights = devices.map((d) => 1 + (100 - d.uptime30d) * 0.8);
  const assignees = (region: Device['region']) =>
    users.filter(
      (u) =>
        u.department === REGION_OWNER[region] &&
        (u.role === 'operator' || u.role === 'lead') &&
        u.status !== 'disabled',
    );

  const makeTicket = (
    rng: Rng,
    base: Omit<Ticket, 'status' | 'respondedAt' | 'resolvedAt' | 'assigneeId' | 'assigneeName'>,
    timing: TicketTiming,
    device: Device,
  ) => {
    const assignee = rng.pick(assignees(device.region));
    const ticket: Ticket = {
      ...base,
      assigneeId: assignee.id,
      assigneeName: assignee.name,
      ...ticketState(timing, nowMs),
    };
    tickets.push(ticket);
    return ticket;
  };

  for (let k = ALARM_WINDOW_DAYS - 1; k >= 0; k--) {
    const day = addDays(today, -k);
    const key = dateKey(day);
    const rng = createRng(`${SEED}:alarms:${key}`);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const base = weekend ? 10 : 17;
    // 约每 3~4 周一次区域性事件（雷暴、停电、光缆中断）：当天告警量 2~3 倍，集中在一个大区
    const incident = rng.bool(0.045)
      ? {
          multiplier: rng.float(2.2, 3),
          region: rng.pick(REGIONS),
          type: rng.pick<AlarmType>(['power', 'link', 'offline']),
        }
      : undefined;
    const normalCount = Math.max(3, Math.round(rng.normal(base, Math.sqrt(base))));
    const count = incident ? Math.round(normalCount * incident.multiplier) : normalCount;
    const incidentDevices = incident ? devices.filter((d) => d.region === incident.region) : [];

    const drafts = Array.from({ length: count }, (_, i) => {
      const fromIncident = incident && i >= normalCount;
      const device = fromIncident ? rng.pick(incidentDevices) : rng.weighted(devices, deviceWeights);
      const type = fromIncident ? incident.type : rng.weighted(ALARM_TYPES, ALARM_TYPE_WEIGHTS);
      const level = rng.weighted(LEVELS, LEVEL_WEIGHTS_BY_TYPE[type]);
      return {
        device,
        type,
        level,
        source: rng.weighted<AlarmSource>(['auto', 'inspection', 'manual'], [80, 12, 8]),
        disposition: rng.weighted(DISPOSITIONS, DISPOSITION_WEIGHTS[level]),
        occurredAt: day.getTime() + pickMinuteOfDay(rng) * MINUTE + rng.int(0, 59) * 1000,
        // 各阶段时长先全部抽出（抽样次数与「现在」无关，保证同一天的随机流稳定）
        closeAfter: rng.logNormal(level === 'critical' || level === 'major' ? 30 : 18, 0.9) * MINUTE,
        ticketDelay: rng.logNormal(6, 0.6) * MINUTE,
        respond: rng.logNormal(RESPOND_MEDIAN[PRIORITY_BY_LEVEL[level]], 0.8) * MINUTE,
        // 约一成一般/提示级工单要等备件或厂商，处理时长拉长 3~5 倍（看板「处理中」的长尾）
        resolve:
          rng.logNormal(RESOLVE_MEDIAN[PRIORITY_BY_LEVEL[level]], 0.65) *
          MINUTE *
          (PRIORITY_BY_LEVEL[level] === 'P3' && rng.bool(0.1) ? rng.float(3, 5) : 1),
        ticketRng: createRng(`${SEED}:ticket:${key}:${i}`),
      };
    }).sort((a, b) => a.occurredAt - b.occurredAt);

    drafts.forEach((draft, index) => {
      if (draft.occurredAt > nowMs) {
        return;
      }
      const id = `ALM-${key}-${String(index + 1).padStart(3, '0')}`;
      const { device } = draft;
      const alarm: Alarm = {
        id,
        deviceId: device.id,
        deviceName: device.name,
        region: device.region,
        city: device.city,
        level: draft.level,
        type: draft.type,
        source: draft.source,
        status: 'active',
        occurredAt: iso(draft.occurredAt),
      };
      if (draft.disposition === 'ticket') {
        const createdAt = draft.occurredAt + draft.ticketDelay;
        if (createdAt <= nowMs) {
          const priority = PRIORITY_BY_LEVEL[draft.level];
          const timing = {
            createdAt,
            respondedAt: createdAt + draft.respond,
            resolvedAt: createdAt + draft.respond + draft.resolve,
          };
          const ticket = makeTicket(
            draft.ticketRng,
            {
              id: `WO-${id.slice(4)}`,
              title: ticketTitle(device, draft.type, locale),
              kind: 'fault',
              alarmId: id,
              deviceId: device.id,
              deviceName: device.name,
              city: device.city,
              priority,
              createdAt: iso(createdAt),
              slaHours: SLA_HOURS[priority],
            },
            timing,
            device,
          );
          alarm.status = 'ticketed';
          alarm.ticketId = ticket.id;
          if (ticket.resolvedAt) {
            alarm.recoveredAt = ticket.resolvedAt;
          }
        }
      } else if (draft.occurredAt + draft.closeAfter <= nowMs) {
        alarm.status = draft.disposition === 'recover' ? 'recovered' : 'falsePositive';
        alarm.recoveredAt = iso(draft.occurredAt + draft.closeAfter);
      }
      alarms.push(alarm);
    });

    // 例行巡检工单：工作日新建 0~2 张，排期在 3~12 天后、现场作业 2~5 天（看板「待处理」「处理中」的主要来源）
    const maintRng = createRng(`${SEED}:maintenance:${key}`);
    const maintCount = weekend ? 0 : Number(maintRng.bool(0.8)) + Number(maintRng.bool(0.4));
    for (let m = 1; m <= maintCount; m++) {
      const device = maintRng.pick(devices);
      const createdAt = day.getTime() + (9 * 60 + maintRng.int(0, 480)) * MINUTE;
      const respondedAt =
        startOfDay(addDays(day, maintRng.int(3, 12))).getTime() + (9 * 60 + maintRng.int(0, 60)) * MINUTE;
      const resolvedAt = respondedAt + maintRng.logNormal(3 * 24 * 60, 0.4) * MINUTE;
      if (createdAt <= nowMs) {
        makeTicket(
          maintRng,
          {
            id: `WO-${key}-M${String(m).padStart(2, '0')}`,
            title: ticketTitle(device, 'maintenance', locale),
            kind: 'maintenance',
            deviceId: device.id,
            deviceName: device.name,
            city: device.city,
            priority: 'P3',
            createdAt: iso(createdAt),
            slaHours: SLA_HOURS.maintenance,
          },
          { createdAt, respondedAt, resolvedAt },
          device,
        );
      }
    }
  }

  // 非在线设备各有一条未恢复的告警（离线 → 设备离线，发生在心跳中断时；故障 → 电源/链路/温度），与设备状态对应
  devices
    .filter((d) => d.status !== 'online')
    .forEach((device) => {
      const rng = createRng(`${SEED}:live:${device.id}`);
      const offline = device.status === 'offline';
      const occurredAt = offline
        ? new Date(device.lastHeartbeatAt).getTime() + rng.int(2, 5) * MINUTE
        : nowMs - Math.min(rng.logNormal(72 * 60, 0.9), 10 * 24 * 60) * MINUTE;
      alarms.push({
        id: `ALM-LIVE-${device.id.slice(4)}`,
        deviceId: device.id,
        deviceName: device.name,
        region: device.region,
        city: device.city,
        level: offline ? 'major' : rng.pick<AlarmLevel>(['major', 'critical']),
        type: offline ? 'offline' : rng.pick<AlarmType>(['power', 'link', 'temperature']),
        source: 'auto',
        status: 'active',
        occurredAt: iso(Math.min(nowMs - MINUTE, occurredAt)),
      });
    });

  alarms.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { alarms, tickets };
};

// ---------------------------------------------------------------- 操作日志

const LOG_ACTIONS: LogAction[] = [
  'login',
  'logout',
  'alarmHandle',
  'ticketAssign',
  'ticketClose',
  'reportExport',
  'userUpdate',
  'userCreate',
  'userDisable',
  'roleUpdate',
];
const LOG_ACTION_WEIGHTS = [30, 10, 18, 12, 12, 6, 5, 2, 1, 1];

const generateLogs = (locale: DemoLocale, now: Date, users: User[], alarms: Alarm[], tickets: Ticket[]) => {
  const nowMs = now.getTime();
  const today = startOfDay(now);
  const lang = locale === 'en-US' ? 'en' : 'zh';
  const active = users.filter((u) => u.status !== 'disabled');
  const admins = active.filter((u) => u.role === 'admin');
  const opsPeople = active.filter((u) => u.role === 'operator' || u.role === 'lead');
  const logs: OperationLog[] = [];

  for (let k = LOG_WINDOW_DAYS - 1; k >= 0; k--) {
    const day = addDays(today, -k);
    const key = dateKey(day);
    const rng = createRng(`${SEED}:logs:${key}`);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const count = Math.max(2, Math.round(rng.normal(weekend ? 6 : 18, 3)));
    const dayStart = day.getTime();
    const dayEnd = dayStart + DAY;
    const within = (value: string | undefined, until: number) =>
      !!value && new Date(value).getTime() >= dayStart && new Date(value).getTime() <= until;

    const drafts = Array.from({ length: count }, () => {
      const at = Math.min(dayEnd - 1000, dayStart + pickMinuteOfDay(rng) * MINUTE + rng.int(0, 59) * 1000);
      const action = rng.weighted(LOG_ACTIONS, LOG_ACTION_WEIGHTS);
      const roll = rng.next();
      const failed = action === 'login' && rng.bool(0.04);
      const ip = pickIp(rng);
      const userAgent = rng.pick(USER_AGENTS);
      // 操作对象只从「操作发生前已存在」的记录里挑，工单类操作由工单处理人执行
      let actor: User = rng.pick(active);
      let target = '';
      if (action === 'alarmHandle') {
        const candidates = alarms.filter((a) => within(a.occurredAt, at));
        const alarm = candidates[Math.floor(roll * candidates.length)];
        target = alarm?.id ?? '';
        actor = rng.pick(opsPeople);
      } else if (action === 'ticketAssign' || action === 'ticketClose') {
        const candidates = tickets.filter((t) =>
          action === 'ticketAssign' ? within(t.createdAt, at) : within(t.resolvedAt, at),
        );
        const ticket = candidates[Math.floor(roll * candidates.length)];
        target = ticket?.id ?? '';
        actor = users.find((u) => u.id === ticket?.assigneeId) ?? actor;
      } else if (action === 'reportExport') {
        target = REPORT_NAMES[Math.floor(roll * REPORT_NAMES.length)][lang];
      } else if (action === 'roleUpdate') {
        target = ROLE_NAMES[ROLE_KEYS[Math.floor(roll * ROLE_KEYS.length)]][lang];
        actor = rng.pick(admins);
      } else if (action.startsWith('user')) {
        target = users[Math.floor(roll * users.length)].name;
        actor = rng.pick(admins);
      }
      return { action, actor, target, failed, at, ip, userAgent };
    })
      .filter((d) => d.at <= nowMs && !((d.action === 'alarmHandle' || d.action.startsWith('ticket')) && !d.target))
      .sort((a, b) => a.at - b.at);

    drafts.forEach((draft, index) => {
      logs.push({
        id: `LOG-${key}-${String(index + 1).padStart(3, '0')}`,
        actorId: draft.actor.id,
        actorName: draft.actor.name,
        action: draft.action,
        target: draft.target,
        result: draft.failed ? 'failure' : 'success',
        ip: draft.ip,
        userAgent: draft.userAgent,
        createdAt: iso(draft.at),
      });
    });
  }
  return logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

// ---------------------------------------------------------------- 日程

const generateEvents = (locale: DemoLocale, now: Date): CalendarEvent[] => {
  const today = startOfDay(now);
  const lang = locale === 'en-US' ? 'en' : 'zh';
  const events: CalendarEvent[] = [];
  const at = (day: Date, hour: number, minute = 0) => iso(day.getTime() + (hour * 60 + minute) * MINUTE);
  const push = (day: Date, type: EventType, title: string, times?: [number, number, number, number]) =>
    events.push({
      id: `EV-${dateKey(day)}-${type}`,
      title,
      type,
      allDay: !times,
      start: times ? at(day, times[0], times[1]) : iso(day.getTime()),
      end: times ? at(day, times[2], times[3]) : undefined,
    });

  for (let k = -EVENT_WINDOW_DAYS; k <= EVENT_WINDOW_DAYS; k++) {
    const day = addDays(today, k);
    const rng = createRng(`${SEED}:events:${dateKey(day)}`);
    const dow = day.getDay();
    const dom = day.getDate();
    if (dow === 1) push(day, 'duty', EVENT_TITLES.duty[lang], [9, 30, 10, 0]);
    if (dow === 2 || dow === 4) {
      const city: City = rng.weighted(
        CITIES,
        CITIES.map((c) => c.weight),
      );
      push(day, 'inspection', `${lang === 'en' ? city.en : city.zh} · ${EVENT_TITLES.inspection[lang]}`);
    }
    // 隔周周四复盘（按一年中的周序奇偶）
    const weekOfYear = Math.floor((day.getTime() - new Date(day.getFullYear(), 0, 1).getTime()) / (7 * DAY));
    if (dow === 4 && weekOfYear % 2 === 0) push(day, 'review', EVENT_TITLES.review[lang], [14, 0, 15, 30]);
    if (dow === 3 && dom <= 7) push(day, 'training', EVENT_TITLES.training[lang], [10, 0, 12, 0]);
    if (dow === 6 && ((dom >= 8 && dom <= 14) || (dom >= 22 && dom <= 28)))
      push(day, 'maintenance', EVENT_TITLES.maintenance[lang], [0, 0, 4, 0]);
    if (dow === 5 && dom >= 8 && dom <= 14) push(day, 'release', EVENT_TITLES.release[lang], [20, 0, 21, 0]);
  }
  return events;
};

// ---------------------------------------------------------------- 汇总

export const generateDataset = ({
  now = new Date(),
  locale = 'zh-CN',
}: { now?: Date; locale?: DemoLocale } = {}): Dataset => {
  const users = generateUsers(locale, now);
  const devices = generateDevices(locale, now);
  const { alarms, tickets } = generateAlarmsAndTickets(locale, now, devices, users);
  const logs = generateLogs(locale, now, users, alarms, tickets);
  const events = generateEvents(locale, now);
  const roles = ROLE_KEYS.map((id, index) => ({
    id,
    permissions: [...DEFAULT_ROLE_PERMISSIONS[id]],
    updatedAt: iso(startOfDay(now).getTime() - (40 + index * 17) * DAY + 10 * HOUR),
  }));
  return { now: now.toISOString(), locale, users, roles, devices, alarms, tickets, logs, events };
};
