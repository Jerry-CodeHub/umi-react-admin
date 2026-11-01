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

/** User presentation returned by a verified server session; authorization remains a server responsibility. */
export interface CurrentUser {
  name: string;
  email: string;
  nickName?: string;
  role?: string;
  /** 五种业务角色之一（演示后端按用户记录解析；真实后端可沿用同一枚举） */
  roleKey?: RoleKey;
  /** 当前会话生效的权限点（服务端逐请求按角色记录解析，改权限立即对已有会话生效） */
  permissions?: string[];
}

/** Real login establishes a Secure HttpOnly SameSite cookie and returns no bearer to JavaScript. */
export interface LoginResult {
  user: CurrentUser;
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

/**
 * 资料编辑可写的字段（审查 F1）：**不含 role**。
 * 角色是一等授权状态，不能随资料编辑一起被写；它有自己的权限点与载荷类型。
 */
export type UserInput = Pick<User, 'name' | 'username' | 'email' | 'department'> & {
  status?: UserStatus;
};

/** 新建用户载荷：可携带初始角色，服务端要求 system.user.role.assign 且角色在可分配范围内 */
export type UserCreateInput = UserInput & { role?: RoleKey };

/** 角色分配载荷：唯一的角色写入通道 */
export type UserRoleAssignment = { role: RoleKey };

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
  | 'userDelete'
  | 'userImport'
  | 'userRoleAssign'
  | 'alarmHandle'
  | 'ticketAssign'
  | 'ticketStart'
  | 'ticketReturn'
  | 'ticketClose'
  | 'ticketAccept'
  | 'ticketRework'
  | 'reportExport'
  | 'roleUpdate'
  | 'roleReset'
  | 'scheduleCreate'
  | 'scheduleUpdate'
  | 'scheduleDelete'
  | 'demoScenario'
  | 'demoReset'
  | 'demoClock';

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
  /**
   * 坐标精度（审查 F12）：'exact' 仅当调用者持有 ops.device.coordinate.view 时出现；
   * 其余身份拿到的是已在服务端粗化（约 10 公里格网）的 lng/lat，绝不返回精确值。
   * 字段本身仍指向同一坐标系，地图与表格无需分支渲染。
   */
  coordinatePrecision: 'exact' | 'coarse';
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
  deviceId?: string;
  level?: AlarmLevel;
  type?: AlarmType;
  status?: AlarmStatus;
  /** 只看未恢复：包含活动告警与已转工单但尚未恢复的告警（业务恢复语义，见 src/demo/availability.ts） */
  unrecovered?: boolean;
  region?: RegionKey;
  from?: string;
  to?: string;
}

export type AlarmHandleAction = 'ticket' | 'falsePositive' | 'recover';

export type TicketStatus = 'todo' | 'doing' | 'done';
export type TicketPriority = 'P1' | 'P2' | 'P3';

/** 一次有效验收签字（当前生效） */
export interface TicketAcceptance {
  signerName: string;
  signedAt: string;
  /** 白底黑字 PNG 的 data URL */
  signature: string;
}

/** 返工后归档的历史验收（已失效，仅留痕） */
export interface TicketAcceptanceRecord extends TicketAcceptance {
  /** 该验收因返工失效的时间 */
  invalidatedAt: string;
  invalidatorName?: string;
}

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
  /** 例行巡检的计划开工时间（故障工单没有排期） */
  scheduledAt?: string;
  respondedAt?: string;
  resolvedAt?: string;
  /** 时限（小时），按优先级：P1 4h / P2 12h / P3 48h；例行巡检 14 天 */
  slaHours: number;
  /** 当前生效的验收签字 */
  acceptance?: TicketAcceptance;
  /** 已失效的历史验收（返工归档，最新在最后） */
  acceptanceHistory?: TicketAcceptanceRecord[];
}

export interface TicketQuery extends PageQuery {
  status?: TicketStatus;
  /** 看板：只取进行中 + 近 N 天完成的工单 */
  board?: boolean;
  keyword?: string;
  priority?: TicketPriority;
  kind?: 'fault' | 'maintenance';
  deviceId?: string;
  from?: string;
  to?: string;
}

/** 批量导入用户的一行输入（Excel 导入提交给服务端复核） */
export interface UserImportRow {
  /** Excel 原始行号：客户端带上用于对账展示，服务端只校验形状（非负整数） */
  row?: number;
  name?: string;
  username?: string;
  email?: string;
  /** 部门 key（DepartmentKey）；界面标签由客户端映射成 key 后再提交 */
  department?: string;
  /**
   * 角色 key（RoleKey）。缺省、空串或纯空白 = 未指定，按默认角色 viewer 创建，不构成角色分配；
   * 非空即一次角色分配：需要 system.user.role.assign（任一行指定即整批判权限），且须在可分配范围内。
   * 界面标签（中英文角色名）不在契约内，由客户端映射成 key。
   */
  role?: string;
}

export interface UserImportResult {
  /** 成功创建数 */
  created: number;
  /** 与现有用户或文件内重复而跳过的行数 */
  duplicated: number;
  /** 校验失败行数 */
  invalid: number;
  /** 新建用户的 ID（按提交顺序） */
  createdIds: string[];
  /** 每行的失败原因（行号为 Excel 里的原始行号；重复行也标注） */
  issues: { row: number; reason: 'duplicate' | 'invalid'; message: string }[];
  users: User[];
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

// ---------------- 演示时钟与场景（仅演示模式） ----------------

/** 登录页「证据层」的演示数据快照（免登录，只含聚合数字；与工作台 KPI 同一口径） */
export interface DemoSnapshot {
  devicesOnline: number;
  devicesTotal: number;
  alarmsToday: number;
  /** 近 30 天故障工单时限达成率（0~1） */
  slaRate: number;
}

/** live 跟随真实时间；frozen 固定在进入场景那一刻（受控演示，页面明确展示「演示时间」） */
export interface DemoClockState {
  mode: 'live' | 'frozen';
  /** frozen 模式的锚点（epoch ms） */
  anchor?: number;
  /** 服务端当前生效的演示时间（ISO） */
  demoTime: string;
}
