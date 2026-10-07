/**
 * 演示后端的接口实现。路径与返回结构即前后端契约（src/services/*.ts 调用、src/services/types.ts 定义），
 * 接真实后端时按同一契约实现即可，前端零改动。
 */
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_KEYS, ROLE_KEYS } from '@/constants/permissions';
import type {
  AlarmHandleAction,
  CalendarEvent,
  CalendarEventInput,
  DepartmentKey,
  EventType,
  LogAction,
  OperationLog,
  RoleKey,
  Ticket,
  TicketStatus,
  User,
  UserBatchAction,
  UserInput,
  UserStatus,
} from '@/services/types';
import { DEPARTMENTS, ROLE_NAMES, TICKET_TITLES, USER_AGENTS } from '../catalog';
import { DAY, SLA_HOURS, type Dataset, type DemoLocale } from '../generate';
import type { DemoStore } from '../store';
import { demoRoleFor, issueDemoToken, type DemoRole } from '../token';
import { buildOverview } from './dashboard';
import { BizFailure, HttpError, inRange, matches, paginate } from './http';
import { message, type MessageKey } from './messages';

export type Session = { username: string; role: DemoRole; user?: User };

export type RouteContext = {
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
  store: DemoStore;
  session?: Session;
  locale: DemoLocale;
};

export type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  /** public 免登录；user 需登录；admin 需管理员（与前端 access.canSeeAdmin 同一口径） */
  access: 'public' | 'user' | 'admin';
  handle: (ctx: RouteContext) => unknown;
};

const DEPARTMENT_KEYS = DEPARTMENTS.map((d) => d.key);
const USER_STATUSES: UserStatus[] = ['active', 'disabled', 'locked'];
const EVENT_TYPES: EventType[] = ['duty', 'inspection', 'review', 'training', 'maintenance', 'release'];
const PROTECTED_USERNAMES = new Set(['admin', 'guest']);
const BOARD_DONE_DAYS = 3;

const nowIso = (ctx: RouteContext) => ctx.store.now().toISOString();
const fail = (ctx: RouteContext, key: MessageKey): never => {
  throw new BizFailure(message(key, ctx.locale));
};
const notFound = (ctx: RouteContext): never => {
  throw new HttpError(404, message('notFound', ctx.locale));
};
const data = (ctx: RouteContext): Dataset => ctx.store.dataset;

let logSeq = 0;
/** 把演示后端里发生的写操作记进操作日志（日志页能看到自己的操作） */
const writeLog = (ctx: RouteContext, action: LogAction, target: string, result: OperationLog['result'] = 'success') => {
  const now = ctx.store.now();
  logSeq += 1;
  ctx.store.create('logs', {
    id: `LOG-${now.getTime().toString(36).toUpperCase()}-${logSeq}`,
    actorId: ctx.session?.user?.id ?? '',
    actorName: ctx.session?.user?.name ?? ctx.session?.username ?? '',
    action,
    target,
    result,
    ip: '192.0.2.10',
    userAgent: USER_AGENTS[0],
    createdAt: now.toISOString(),
  });
};

const findUser = (ctx: RouteContext, id: string) => data(ctx).users.find((u) => u.id === id) ?? notFound(ctx);

/** 新建/编辑用户的字段校验（部分更新时只校验传入的字段） */
const validateUser = (ctx: RouteContext, input: Partial<UserInput>, selfId?: string) => {
  if (input.name !== undefined && !String(input.name).trim()) fail(ctx, 'nameRequired');
  if (input.username !== undefined) {
    const username = String(input.username).trim().toLowerCase();
    if (!/^[a-z][a-z0-9._-]{2,31}$/.test(username)) fail(ctx, 'usernameRequired');
    if (data(ctx).users.some((u) => u.username.toLowerCase() === username && u.id !== selfId))
      fail(ctx, 'usernameTaken');
  }
  if (input.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email))) fail(ctx, 'emailInvalid');
  if (input.department !== undefined && !DEPARTMENT_KEYS.includes(input.department)) fail(ctx, 'notFound');
  if (input.role !== undefined && !ROLE_KEYS.includes(input.role)) fail(ctx, 'notFound');
  if (input.status !== undefined && !USER_STATUSES.includes(input.status)) fail(ctx, 'notFound');
};

const isProtected = (ctx: RouteContext, user: User) =>
  PROTECTED_USERNAMES.has(user.username) || user.id === ctx.session?.user?.id;

const pickUserInput = (body: Record<string, unknown>): Partial<UserInput> => {
  const input: Partial<UserInput> = {};
  (['name', 'username', 'email', 'department', 'role', 'status'] as const).forEach((key) => {
    if (body[key] !== undefined) (input as Record<string, unknown>)[key] = body[key];
  });
  if (typeof input.username === 'string') input.username = input.username.trim().toLowerCase();
  if (typeof input.name === 'string') input.name = input.name.trim();
  return input;
};

/** 工单状态流转：同步响应、完成时刻与关联告警 */
const moveTicket = (ctx: RouteContext, ticket: Ticket, status: TicketStatus) => {
  const now = nowIso(ctx);
  const changes: Partial<Ticket> =
    status === 'todo'
      ? { status, respondedAt: undefined, resolvedAt: undefined }
      : status === 'doing'
        ? { status, respondedAt: ticket.respondedAt ?? now, resolvedAt: undefined }
        : { status, respondedAt: ticket.respondedAt ?? now, resolvedAt: ticket.resolvedAt ?? now };
  ctx.store.update('tickets', ticket.id, changes);
  if (ticket.alarmId) {
    ctx.store.update('alarms', ticket.alarmId, { recoveredAt: status === 'done' ? changes.resolvedAt : undefined });
  }
  if (status === 'done') writeLog(ctx, 'ticketClose', ticket.id);
};

export const routes: Route[] = [
  // ------------------------------------------------ 鉴权
  {
    method: 'POST',
    path: '/api/v1/login',
    access: 'public',
    handle: (ctx) => {
      const name = String(ctx.body.name ?? '').trim();
      if (!name) throw new HttpError(400, message('usernameRequired', ctx.locale));
      const user = data(ctx).users.find((u) => u.username.toLowerCase() === name.toLowerCase());
      if (user?.status === 'disabled') fail(ctx, 'accountDisabled');
      if (user?.status === 'locked') fail(ctx, 'accountLocked');
      // 演示约定：种子用户按其角色签发（管理员才有管理权限）；其余任意用户名放行为管理员，受限体验名除外
      const role: DemoRole = user ? (user.role === 'admin' ? 'admin' : 'user') : demoRoleFor(name);
      const session: Session = { username: user?.username ?? name, role, user };
      if (user) {
        ctx.store.update('users', user.id, { lastLoginAt: nowIso(ctx), lastLoginIp: '192.0.2.10' });
      }
      writeLog({ ...ctx, session }, 'login', '');
      return {
        token: issueDemoToken(session.username, role),
        user: { name: session.username, nickName: user?.name ?? name, email: user?.email ?? '', role },
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/currentUser',
    access: 'user',
    handle: ({ session }) => ({
      name: session!.username,
      nickName: session!.user?.name ?? session!.username,
      email: session!.user?.email ?? '',
      role: session!.role,
    }),
  },
  {
    method: 'POST',
    path: '/api/v1/logout',
    access: 'user',
    handle: (ctx) => {
      writeLog(ctx, 'logout', '');
      return null;
    },
  },

  // ------------------------------------------------ 用户
  {
    method: 'GET',
    path: '/api/v1/users',
    access: 'admin',
    handle: (ctx) => {
      const { keyword, department, role, status } = ctx.query;
      const list = data(ctx).users.filter(
        (u) =>
          matches(keyword, u.name, u.username, u.email, u.id) &&
          (!department || u.department === department) &&
          (!role || u.role === role) &&
          (!status || u.status === status),
      );
      return paginate(list, ctx.query);
    },
  },
  { method: 'GET', path: '/api/v1/users/:id', access: 'admin', handle: (ctx) => findUser(ctx, ctx.params.id) },
  {
    method: 'POST',
    path: '/api/v1/users',
    access: 'admin',
    handle: (ctx) => {
      const input = pickUserInput(ctx.body);
      validateUser(ctx, { name: '', username: '', email: '', ...input });
      const maxId = Math.max(...data(ctx).users.map((u) => Number(u.id.slice(1)) || 0), 1000);
      const user: User = {
        id: `U${maxId + 1}`,
        name: input.name!,
        username: input.username!,
        email: input.email!,
        phone: '',
        department: (input.department ?? 'support') as DepartmentKey,
        role: (input.role ?? 'viewer') as RoleKey,
        status: input.status ?? 'active',
        createdAt: nowIso(ctx),
      };
      ctx.store.create('users', user);
      writeLog(ctx, 'userCreate', user.name);
      return user;
    },
  },
  {
    method: 'PUT',
    path: '/api/v1/users/:id',
    access: 'admin',
    handle: (ctx) => {
      const user = findUser(ctx, ctx.params.id);
      const input = pickUserInput(ctx.body);
      validateUser(ctx, input, user.id);
      if (input.status && input.status !== 'active' && isProtected(ctx, user)) fail(ctx, 'protectedAccount');
      if (PROTECTED_USERNAMES.has(user.username)) delete input.username;
      const updated = ctx.store.update('users', user.id, input)!;
      writeLog(ctx, input.status === 'disabled' ? 'userDisable' : 'userUpdate', updated.name);
      return updated;
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/users/:id',
    access: 'admin',
    handle: (ctx) => {
      const user = findUser(ctx, ctx.params.id);
      if (isProtected(ctx, user)) fail(ctx, 'protectedAccount');
      ctx.store.remove('users', user.id);
      writeLog(ctx, 'userUpdate', user.name);
      return user.id;
    },
  },
  {
    method: 'POST',
    path: '/api/v1/users/batch',
    access: 'admin',
    handle: (ctx) => {
      const ids = Array.isArray(ctx.body.ids) ? (ctx.body.ids as string[]) : [];
      const action = ctx.body.action as UserBatchAction;
      const users = ids.map((id) => findUser(ctx, id));
      if (action !== 'enable' && users.some((u) => isProtected(ctx, u))) fail(ctx, 'protectedAccount');
      users.forEach((user) => {
        if (action === 'delete') {
          ctx.store.remove('users', user.id);
        } else {
          ctx.store.update('users', user.id, { status: action === 'enable' ? 'active' : 'disabled' });
        }
        writeLog(ctx, action === 'disable' ? 'userDisable' : 'userUpdate', user.name);
      });
      return users.length;
    },
  },

  // ------------------------------------------------ 角色
  {
    method: 'GET',
    path: '/api/v1/roles',
    access: 'admin',
    handle: (ctx) =>
      data(ctx).roles.map((role) => ({
        ...role,
        memberCount: data(ctx).users.filter((u) => u.role === role.id).length,
      })),
  },
  {
    method: 'PUT',
    path: '/api/v1/roles/:id',
    access: 'admin',
    handle: (ctx) => {
      const role = data(ctx).roles.find((r) => r.id === ctx.params.id) ?? notFound(ctx);
      const permissions = (Array.isArray(ctx.body.permissions) ? (ctx.body.permissions as string[]) : []).filter(
        (key) => PERMISSION_KEYS.includes(key),
      );
      if (role.id === 'admin' && permissions.length !== PERMISSION_KEYS.length) fail(ctx, 'adminRoleLocked');
      const updated = ctx.store.update('roles', role.id, { permissions, updatedAt: nowIso(ctx) })!;
      writeLog(ctx, 'roleUpdate', ROLE_NAMES[role.id][ctx.locale === 'en-US' ? 'en' : 'zh']);
      return { ...updated, memberCount: data(ctx).users.filter((u) => u.role === role.id).length };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/roles/:id/reset',
    access: 'admin',
    handle: (ctx) => {
      const role = data(ctx).roles.find((r) => r.id === ctx.params.id) ?? notFound(ctx);
      ctx.store.update('roles', role.id, {
        permissions: [...DEFAULT_ROLE_PERMISSIONS[role.id]],
        updatedAt: nowIso(ctx),
      });
      return null;
    },
  },

  // ------------------------------------------------ 操作日志
  {
    method: 'GET',
    path: '/api/v1/logs',
    access: 'admin',
    handle: (ctx) => {
      const { keyword, action, result, from, to, actorId } = ctx.query;
      const list = data(ctx).logs.filter(
        (log) =>
          matches(keyword, log.actorName, log.target, log.ip) &&
          (!action || log.action === action) &&
          (!result || log.result === result) &&
          (!actorId || log.actorId === actorId) &&
          inRange(log.createdAt, from, to),
      );
      return paginate(list, ctx.query);
    },
  },

  // ------------------------------------------------ 设备
  {
    method: 'GET',
    path: '/api/v1/devices',
    access: 'user',
    handle: (ctx) => {
      const { keyword, region, status, model } = ctx.query;
      const list = data(ctx).devices.filter(
        (d) =>
          matches(keyword, d.name, d.id, d.city) &&
          (!region || d.region === region) &&
          (!status || d.status === status) &&
          (!model || d.model === model),
      );
      return paginate(list, ctx.query);
    },
  },
  { method: 'GET', path: '/api/v1/devices/all', access: 'user', handle: (ctx) => data(ctx).devices },
  {
    method: 'GET',
    path: '/api/v1/devices/:id',
    access: 'user',
    handle: (ctx) => {
      const device = data(ctx).devices.find((d) => d.id === ctx.params.id) ?? notFound(ctx);
      return {
        ...device,
        recentAlarms: data(ctx)
          .alarms.filter((a) => a.deviceId === device.id)
          .slice(0, 10),
      };
    },
  },

  // ------------------------------------------------ 告警
  {
    method: 'GET',
    path: '/api/v1/alarms',
    access: 'user',
    handle: (ctx) => {
      const { keyword, level, type, status, region, from, to } = ctx.query;
      const list = data(ctx).alarms.filter(
        (a) =>
          matches(keyword, a.id, a.deviceName, a.city) &&
          (!level || a.level === level) &&
          (!type || a.type === type) &&
          (!status || a.status === status) &&
          (!region || a.region === region) &&
          inRange(a.occurredAt, from, to),
      );
      return paginate(list, ctx.query);
    },
  },
  {
    method: 'POST',
    path: '/api/v1/alarms/:id/handle',
    access: 'user',
    handle: (ctx) => {
      const alarm = data(ctx).alarms.find((a) => a.id === ctx.params.id) ?? notFound(ctx);
      if (alarm.status !== 'active') fail(ctx, 'alarmClosed');
      const action = ctx.body.action as AlarmHandleAction;
      const now = nowIso(ctx);
      if (action === 'ticket') {
        const device = data(ctx).devices.find((d) => d.id === alarm.deviceId)!;
        const assignee = ctx.session?.user ?? data(ctx).users[0];
        const priority = alarm.level === 'critical' ? 'P1' : alarm.level === 'major' ? 'P2' : 'P3';
        const ticket: Ticket = {
          id: `WO-${alarm.id.slice(4)}`,
          title: `${device.name} · ${TICKET_TITLES[alarm.type][ctx.locale === 'en-US' ? 'en' : 'zh']}`,
          kind: 'fault',
          alarmId: alarm.id,
          deviceId: device.id,
          deviceName: device.name,
          city: device.city,
          priority,
          status: 'todo',
          assigneeId: assignee.id,
          assigneeName: assignee.name,
          createdAt: now,
          slaHours: SLA_HOURS[priority],
        };
        ctx.store.create('tickets', ticket);
        ctx.store.update('alarms', alarm.id, { status: 'ticketed', ticketId: ticket.id });
      } else {
        ctx.store.update('alarms', alarm.id, {
          status: action === 'recover' ? 'recovered' : 'falsePositive',
          recoveredAt: now,
        });
      }
      writeLog(ctx, 'alarmHandle', alarm.id);
      return data(ctx).alarms.find((a) => a.id === alarm.id);
    },
  },

  // ------------------------------------------------ 工单
  {
    method: 'GET',
    path: '/api/v1/tickets',
    access: 'user',
    handle: (ctx) => {
      const { status, board } = ctx.query;
      const since = ctx.store.now().getTime() - BOARD_DONE_DAYS * DAY;
      const list = data(ctx).tickets.filter(
        (t) =>
          (!status || t.status === status) &&
          (!board || board === 'false' || t.status !== 'done' || new Date(t.resolvedAt!).getTime() >= since),
      );
      return paginate(list, { pageSize: board ? 200 : 20, ...ctx.query });
    },
  },
  {
    method: 'PUT',
    path: '/api/v1/tickets/:id',
    access: 'user',
    handle: (ctx) => {
      const ticket = data(ctx).tickets.find((t) => t.id === ctx.params.id) ?? notFound(ctx);
      const status = ctx.body.status as TicketStatus;
      if (status && status !== ticket.status) moveTicket(ctx, ticket, status);
      return data(ctx).tickets.find((t) => t.id === ticket.id);
    },
  },
  {
    method: 'POST',
    path: '/api/v1/tickets/:id/acceptance',
    access: 'user',
    handle: (ctx) => {
      const ticket = data(ctx).tickets.find((t) => t.id === ctx.params.id) ?? notFound(ctx);
      if (ticket.status !== 'done') fail(ctx, 'ticketNotDone');
      return ctx.store.update('tickets', ticket.id, {
        acceptance: {
          signerName: ctx.session?.user?.name ?? ctx.session?.username ?? '',
          signedAt: nowIso(ctx),
          signature: String(ctx.body.signature ?? ''),
        },
      });
    },
  },

  // ------------------------------------------------ 工作台
  {
    method: 'GET',
    path: '/api/v1/dashboard/overview',
    access: 'user',
    handle: (ctx) => buildOverview(data(ctx), ctx.store.now()),
  },

  // ------------------------------------------------ 日程
  {
    method: 'GET',
    path: '/api/v1/events',
    access: 'user',
    handle: (ctx) => data(ctx).events.filter((e) => inRange(e.start, ctx.query.from, ctx.query.to)),
  },
  {
    method: 'POST',
    path: '/api/v1/events',
    access: 'user',
    handle: (ctx) => {
      const input = ctx.body as Partial<CalendarEventInput>;
      if (!input.title?.trim()) fail(ctx, 'titleRequired');
      const event: CalendarEvent = {
        id: `EV-U${ctx.store.now().getTime().toString(36).toUpperCase()}`,
        title: input.title!.trim(),
        type: EVENT_TYPES.includes(input.type as EventType) ? (input.type as EventType) : 'review',
        start: String(input.start),
        end: input.end ? String(input.end) : undefined,
        allDay: !!input.allDay,
      };
      ctx.store.create('events', event);
      return event;
    },
  },
  {
    method: 'PUT',
    path: '/api/v1/events/:id',
    access: 'user',
    handle: (ctx) => {
      const event = data(ctx).events.find((e) => e.id === ctx.params.id) ?? notFound(ctx);
      const changes: Partial<CalendarEvent> = {};
      (['title', 'type', 'start', 'end', 'allDay'] as const).forEach((key) => {
        if (key in ctx.body) (changes as Record<string, unknown>)[key] = ctx.body[key] ?? undefined;
      });
      return ctx.store.update('events', event.id, changes);
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/events/:id',
    access: 'user',
    handle: (ctx) => {
      if (!ctx.store.remove('events', ctx.params.id)) notFound(ctx);
      return ctx.params.id;
    },
  },

  // ------------------------------------------------ 演示数据
  {
    method: 'POST',
    path: '/api/v1/demo/reset',
    access: 'user',
    handle: (ctx) => {
      ctx.store.reset();
      return null;
    },
  },
];
