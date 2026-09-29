import type {
  AlarmLevel,
  AlarmStatus,
  AlarmType,
  DepartmentKey,
  DeviceStatus,
  EventType,
  LogAction,
  RegionKey,
  TicketStatus,
  UserStatus,
} from '@/services/types';

/** 枚举取值的固定顺序（筛选项、图例、表格都按这个顺序） */
export const REGION_KEYS: RegionKey[] = ['north', 'east', 'south', 'central', 'southwest', 'northwest', 'northeast'];
export const DEPARTMENT_KEYS: DepartmentKey[] = [
  'ops1',
  'ops2',
  'ops3',
  'analytics',
  'platform',
  'security',
  'support',
];
export const USER_STATUS_KEYS: UserStatus[] = ['active', 'disabled', 'locked'];
export const DEVICE_STATUS_KEYS: DeviceStatus[] = ['online', 'offline', 'fault'];
export const ALARM_LEVEL_KEYS: AlarmLevel[] = ['critical', 'major', 'minor', 'info'];
export const ALARM_TYPE_KEYS: AlarmType[] = ['interference', 'signal', 'link', 'offline', 'power', 'temperature'];
export const ALARM_STATUS_KEYS: AlarmStatus[] = ['active', 'recovered', 'ticketed', 'falsePositive'];
export const TICKET_STATUS_KEYS: TicketStatus[] = ['todo', 'doing', 'done'];
export const EVENT_TYPE_KEYS: EventType[] = ['duty', 'inspection', 'review', 'training', 'maintenance', 'release'];
export const LOG_ACTION_KEYS: LogAction[] = [
  'login',
  'logout',
  'userCreate',
  'userUpdate',
  'userDisable',
  'alarmHandle',
  'ticketAssign',
  'ticketClose',
  'reportExport',
  'roleUpdate',
];
