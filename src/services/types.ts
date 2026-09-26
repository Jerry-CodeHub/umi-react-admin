/**
 * 前后端接口契约（演示后端 src/demo/server 与真实后端共用同一份类型）。
 * 时间字段一律 ISO 8601 字符串；枚举只传 key，界面文案由 src/locales 负责。
 */

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  errorCode: number;
  message?: string;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  current: number;
  pageSize: number;
}

export interface PageQuery {
  current?: number;
  pageSize?: number;
  /** 排序：字段名与方向，如 lastLoginAt / descend */
  sortField?: string;
  sortOrder?: 'ascend' | 'descend';
}

// ---------------- 组织与权限 ----------------

export type RegionKey = 'north' | 'east' | 'south' | 'central' | 'southwest' | 'northwest' | 'northeast';
export type DepartmentKey = 'ops1' | 'ops2' | 'ops3' | 'analytics' | 'platform' | 'security' | 'support';
export type RoleKey = 'admin' | 'lead' | 'operator' | 'analyst' | 'viewer';
export type UserStatus = 'active' | 'disabled' | 'locked';

export interface User {
  id: string;
  /** 登录名 */
  username: string;
  name: string;
  email: string;
  /** 手机号只以脱敏形式存在（演示数据不生成完整号码） */
  phone: string;
  department: DepartmentKey;
  role: RoleKey;
  status: UserStatus;
  createdAt: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
}

export type UserInput = Pick<User, 'name' | 'username' | 'email' | 'department' | 'role'> & {
  status?: UserStatus;
};

export interface UserQuery extends PageQuery {
  keyword?: string;
  department?: DepartmentKey;
  role?: RoleKey;
  status?: UserStatus;
}

export type UserBatchAction = 'enable' | 'disable' | 'delete';

export interface Role {
  id: RoleKey;
  /** 权限点 key，见 PERMISSION_TREE */
  permissions: string[];
  memberCount: number;
  updatedAt: string;
}

export type LogAction =
  | 'login'
  | 'logout'
  | 'userCreate'
  | 'userUpdate'
  | 'userDisable'
  | 'alarmHandle'
  | 'ticketAssign'
  | 'ticketClose'
  | 'reportExport'
  | 'roleUpdate';

export interface OperationLog {
  id: string;
  actorId: string;
  actorName: string;
  action: LogAction;
  /** 操作对象（用户名、工单号、设备名……） */
  target: string;
  result: 'success' | 'failure';
  ip: string;
  userAgent: string;
  createdAt: string;
}

export interface LogQuery extends PageQuery {
  keyword?: string;
  action?: LogAction;
  result?: OperationLog['result'];
  from?: string;
  to?: string;
  actorId?: string;
}

// ---------------- 设备运维 ----------------

export type DeviceStatus = 'online' | 'offline' | 'fault';

export interface Device {
  id: string;
  name: string;
  region: RegionKey;
  city: string;
  lng: number;
  lat: number;
  model: string;
  /** 监测频段 [起, 止]，单位 MHz */
  band: [number, number];
  status: DeviceStatus;
  firmware: string;
  installedAt: string;
  lastHeartbeatAt: string;
  /** 近 30 天在线率（%） */
  uptime30d: number;
  /** 当前接收电平（dBm） */
  signalDbm: number;
}

export interface DeviceQuery extends PageQuery {
  keyword?: string;
  region?: RegionKey;
  status?: DeviceStatus;
  model?: string;
}

export type AlarmLevel = 'critical' | 'major' | 'minor' | 'info';
export type AlarmType = 'interference' | 'signal' | 'link' | 'offline' | 'power' | 'temperature';
export type AlarmSource = 'auto' | 'inspection' | 'manual';
/** active 未恢复；recovered 自动恢复；ticketed 已转工单；falsePositive 误报关闭 */
export type AlarmStatus = 'active' | 'recovered' | 'ticketed' | 'falsePositive';

export interface Alarm {
  id: string;
  deviceId: string;
  deviceName: string;
  region: RegionKey;
  city: string;
  level: AlarmLevel;
  type: AlarmType;
  source: AlarmSource;
  status: AlarmStatus;
  occurredAt: string;
  recoveredAt?: string;
  ticketId?: string;
}

export interface AlarmQuery extends PageQuery {
  keyword?: string;
  level?: AlarmLevel;
  type?: AlarmType;
  status?: AlarmStatus;
  region?: RegionKey;
  from?: string;
  to?: string;
}

export type AlarmHandleAction = 'ticket' | 'falsePositive' | 'recover';

export type TicketStatus = 'todo' | 'doing' | 'done';
export type TicketPriority = 'P1' | 'P2' | 'P3';

export interface Ticket {
  id: string;
  title: string;
  kind: 'fault' | 'maintenance';
  alarmId?: string;
  deviceId: string;
  deviceName: string;
  city: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId: string;
  assigneeName: string;
  createdAt: string;
  respondedAt?: string;
  resolvedAt?: string;
  /** 时限（小时），按优先级：P1 4h / P2 12h / P3 48h；例行巡检 14 天 */
  slaHours: number;
  /** 验收签字（签名页演示） */
  acceptance?: { signerName: string; signedAt: string; signature: string };
}

export interface TicketQuery extends PageQuery {
  status?: TicketStatus;
  /** 看板：只取进行中 + 近 N 天完成的工单 */
  board?: boolean;
}

// ---------------- 工作台 ----------------

export interface DashboardOverview {
  generatedAt: string;
  kpi: {
    devicesTotal: number;
    devicesOnline: number;
    alarmsToday: number;
    /** 昨天截至同一时刻的告警数，用于环比 */
    alarmsYesterdaySamePeriod: number;
    /** 近 7 天每日告警数（含今天），迷你趋势 */
    alarms7d: number[];
    /** 近 30 天完成的故障工单中按时限完成的比例（0~1），Prev 为再往前 30 天 */
    slaRate: number;
    slaRatePrev: number;
    /** 近 30 天平均响应时长（分钟） */
    avgResponseMinutes: number;
    avgResponseMinutesPrev: number;
  };
  /** 近 90 天每日按级别的告警数 */
  alarmTrend: { date: string; level: AlarmLevel; count: number }[];
  /** 近 30 天告警类型分布 */
  alarmTypes: { type: AlarmType; count: number }[];
  /** 各大区设备在线率 */
  regionOnline: { region: RegionKey; online: number; total: number }[];
  /** 近 30 天处置流向：级别 → 处置方式 → 结果。节点为 key（level:critical / disposition:ticketed / result:inSla） */
  disposition: { source: string; target: string; value: number }[];
  /** 设备健康：近 30 天在线率 × 告警数 */
  deviceHealth: { id: string; name: string; region: RegionKey; uptime30d: number; alarms30d: number }[];
  /** 大区 → 城市 设备数 */
  regionTree: { region: RegionKey; cities: { city: string; count: number }[] }[];
  /** 最新动态 */
  activities: {
    id: string;
    kind: 'alarm' | 'ticketCreated' | 'ticketDone';
    level?: AlarmLevel;
    alarmType?: AlarmType;
    deviceName: string;
    ticketId?: string;
    assigneeName?: string;
    at: string;
  }[];
}

// ---------------- 日程 ----------------

export type EventType = 'duty' | 'inspection' | 'review' | 'training' | 'maintenance' | 'release';

export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  start: string;
  end?: string;
  allDay: boolean;
}

export type CalendarEventInput = Omit<CalendarEvent, 'id'>;
