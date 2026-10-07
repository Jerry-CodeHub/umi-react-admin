import { api, compact } from './client';
import type { LogQuery, OperationLog, PageResult, Role, RoleKey } from './types';

export const listRoles = () => api<Role[]>('/api/v1/roles');

export const updateRolePermissions = (id: RoleKey, permissions: string[]) =>
  api<Role>(`/api/v1/roles/${id}`, { method: 'PUT', data: { permissions } });

export const resetRolePermissions = (id: RoleKey) => api<null>(`/api/v1/roles/${id}/reset`, { method: 'POST' });

export const listLogs = (query: LogQuery) =>
  api<PageResult<OperationLog>>('/api/v1/logs', { method: 'GET', params: compact(query) });

/** 重置演示数据（仅演示模式可用） */
export const resetDemoData = () => api<null>('/api/v1/demo/reset', { method: 'POST' });
