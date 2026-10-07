import type { AlarmLevel, DeviceStatus, TicketPriority, TicketStatus, UserStatus } from '@/services/types';

/**
 * 全站语义色：同一个含义在表格 Tag、图表、地图点位、日历上用同一种颜色。
 * 值是 antd 预设色名（Tag 的 color 直接可用）；图表用 useChartTheme 把它换算成当前主题下的色值。
 */
export const LEVEL_COLOR: Record<AlarmLevel, PresetColor> = {
  critical: 'red',
  major: 'orange',
  minor: 'gold',
  info: 'blue',
};

export const DEVICE_STATUS_COLOR: Record<DeviceStatus, PresetColor> = {
  online: 'green',
  offline: 'grey',
  fault: 'red',
};

/** 设备状态的具体色值（地图点位等非 antd 组件使用；与 DEVICE_STATUS_COLOR 同义） */
export const DEVICE_STATUS_CSS: Record<DeviceStatus, string> = {
  online: '#52c41a',
  offline: '#8c8c8c',
  fault: '#ff4d4f',
};

export const TICKET_STATUS_COLOR: Record<TicketStatus, PresetColor> = {
  todo: 'grey',
  doing: 'blue',
  done: 'green',
};

export const PRIORITY_COLOR: Record<TicketPriority, PresetColor> = { P1: 'red', P2: 'orange', P3: 'blue' };

export const USER_STATUS_BADGE: Record<UserStatus, 'success' | 'default' | 'error'> = {
  active: 'success',
  disabled: 'default',
  locked: 'error',
};

/** 分类色板（大区、类型等无序类别）：6 色以内，顺序固定 */
export const CATEGORY_COLORS: PresetColor[] = ['blue', 'cyan', 'purple', 'gold', 'magenta', 'green', 'volcano'];

export type PresetColor =
  | 'blue'
  | 'cyan'
  | 'green'
  | 'gold'
  | 'orange'
  | 'red'
  | 'purple'
  | 'magenta'
  | 'volcano'
  | 'geekblue'
  | 'lime'
  | 'grey';
