import type { RoleKey } from '@/services/types';

/** 权限点树（key 即 i18n 键 `permission.<key>` 的后缀）。角色管理页渲染它，演示后端按它初始化角色 */
export type PermissionNode = { key: string; children?: PermissionNode[] };

export const PERMISSION_TREE: PermissionNode[] = [
  { key: 'dashboard', children: [{ key: 'dashboard.view' }] },
  {
    key: 'system',
    children: [
      { key: 'system.user.view' },
      { key: 'system.user.create' },
      { key: 'system.user.update' },
      { key: 'system.user.delete' },
      { key: 'system.role.view' },
      { key: 'system.role.update' },
      { key: 'system.log.view' },
    ],
  },
  {
    key: 'ops',
    children: [
      { key: 'ops.device.view' },
      { key: 'ops.device.update' },
      { key: 'ops.alarm.view' },
      { key: 'ops.alarm.handle' },
      { key: 'ops.ticket.view' },
      { key: 'ops.ticket.assign' },
      { key: 'ops.ticket.close' },
    ],
  },
  { key: 'doc', children: [{ key: 'doc.export' }] },
];

/** 叶子权限点 */
export const PERMISSION_KEYS: string[] = PERMISSION_TREE.flatMap((group) => group.children?.map((c) => c.key) ?? []);

const pick = (prefixes: string[]) => PERMISSION_KEYS.filter((key) => prefixes.some((p) => key.startsWith(p)));

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, string[]> = {
  admin: PERMISSION_KEYS,
  lead: pick(['dashboard.', 'system.user.view', 'system.log.view', 'ops.', 'doc.']),
  operator: pick([
    'dashboard.',
    'ops.device.view',
    'ops.alarm.view',
    'ops.alarm.handle',
    'ops.ticket.view',
    'ops.ticket.close',
  ]),
  analyst: pick(['dashboard.', 'ops.device.view', 'ops.alarm.view', 'ops.ticket.view', 'doc.']),
  viewer: pick(['dashboard.', 'ops.device.view']),
};

export const ROLE_KEYS: RoleKey[] = ['admin', 'lead', 'operator', 'analyst', 'viewer'];
