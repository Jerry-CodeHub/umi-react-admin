import { api, compact } from './client';
import type {
  Alarm,
  AlarmHandleAction,
  AlarmQuery,
  DashboardOverview,
  Device,
  DeviceQuery,
  PageResult,
  Ticket,
  TicketQuery,
  TicketStatus,
} from './types';

export const getDashboardOverview = () => api<DashboardOverview>('/api/v1/dashboard/overview');

export const listDevices = (query: DeviceQuery) =>
  api<PageResult<Device>>('/api/v1/devices', { method: 'GET', params: compact(query) });

/** 全量设备（地图、频段图使用） */
export const listAllDevices = () => api<Device[]>('/api/v1/devices/all');

export const getDevice = (id: string) =>
  api<Device & { recentAlarms: Alarm[] }>(`/api/v1/devices/${encodeURIComponent(id)}`);

export const listAlarms = (query: AlarmQuery) =>
  api<PageResult<Alarm>>('/api/v1/alarms', { method: 'GET', params: compact(query) });

export const handleAlarm = (id: string, action: AlarmHandleAction) =>
  api<Alarm>(`/api/v1/alarms/${encodeURIComponent(id)}/handle`, { method: 'POST', data: { action } });

export const listTickets = (query: TicketQuery) =>
  api<PageResult<Ticket>>('/api/v1/tickets', { method: 'GET', params: compact(query) });

export const moveTicket = (id: string, status: TicketStatus) =>
  api<Ticket>(`/api/v1/tickets/${encodeURIComponent(id)}`, { method: 'PUT', data: { status } });

export const signTicket = (id: string, signature: string) =>
  api<Ticket>(`/api/v1/tickets/${encodeURIComponent(id)}/acceptance`, { method: 'POST', data: { signature } });
