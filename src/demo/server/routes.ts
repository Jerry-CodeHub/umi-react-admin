/**
 * 演示后端的接口实现。路径与返回结构即前后端契约（src/services/*.ts 调用、src/services/types.ts 定义），
 * 接真实后端时按同一契约实现即可，前端零改动。
 *
 * 授权口径（审查 F02 修复）：每条路由声明所需权限点（src/constants/permissions.ts 的 key），
 * 服务端按「当前会话用户 → 用户角色 → 角色权限记录」逐请求解析——角色权限被修改后，
 * 已有会话与重新登录的会话立即执行同一份权限。隐藏按钮只是 UX，这里才是真正的检查。
 */
import {
  ASSIGNABLE_ROLE_KEYS,
  canManageAccount,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_KEYS,
  ROLE_KEYS,
  USER_IMPORT_FIELDS,
  USER_IMPORT_LIMITS,
  USER_IMPORT_ROW_FIELDS,
} from '@/constants/permissions';
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
  UserImportResult,
  UserImportRow,
  UserInput,
  UserStatus,
} from '@/services/types';
import { serializeDeviceCoordinates, serializeDeviceListCoordinates } from '@/utils/deviceCoordinate';
import { safeSignature } from '@/utils/signature';
import { applyDerivedStatus } from '../availability';
import { DEPARTMENTS, REGION_OWNER, ROLE_NAMES, TICKET_TITLES, USER_AGENTS } from '../catalog';
import { demoClock } from '../clock';
import { DAY, SLA_HOURS, type Dataset, type DemoLocale } from '../generate';
import type { DemoStore } from '../store';
import { demoRoleFor, issueDemoToken, type DemoRole } from '../token';
import { buildOverview } from './dashboard';
import { BizFailure, HttpError, inRange, matches, paginate } from './http';
import { message, type MessageKey } from './messages';

export type Session = {
  username: string;
  role: DemoRole;
  user?: User;
  /** 用户五种业务角色之一（无种子记录的演示登录名没有 roleKey） */
  roleKey?: RoleKey;
  /** 逐请求解析的生效权限点（来自角色记录；管理员演示约定为全量） */
  permissions: string[];
};

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
  /** 'public' 免登录；缺省需登录；其余值为所需权限点 key（PERMISSION_KEYS 之一） */
  access?: 'public' | (string & {});
  handle: (ctx: RouteContext) => unknown;
};

const DEPARTMENT_KEYS = DEPARTMENTS.map((d) => d.key);
const USER_STATUSES: UserStatus[] = ['active', 'disabled', 'locked'];
const EVENT_TYPES: EventType[] = ['duty', 'inspection', 'review', 'training', 'maintenance', 'release'];
/** 受保护账号：五种快捷体验账号不能被停用/删除/改名，避免演示自断入口 */
/** 体验/种子账号名：既是受保护账号，也是「删除后 token 必须失效」的判定集合（见 server/index.ts） */
export const PROTECTED_USERNAMES = new Set(['admin', 'guest', 'lead', 'operator', 'analyst']);
const BOARD_DONE_DAYS = 3;

/** 批量用户动作 → 操作日志 action（与单条 DELETE/PUT 保持同一套命名，便于按 action 过滤） */
const BATCH_LOG_ACTION: Record<UserBatchAction, LogAction> = {
  enable: 'userUpdate',
  disable: 'userDisable',
  delete: 'userDelete',
};

const nowIso = (ctx: RouteContext) => ctx.store.now().toISOString();
const fail = (ctx: RouteContext, key: MessageKey): never => {
  throw new BizFailure(message(key, ctx.locale));
};
/** 判定为「请求/授权失败」的分支：返回 HttpError，让调用方拿到真正的 4xx 而不是 200+success:false */
const httpError = (ctx: RouteContext, status: number, key: MessageKey) =>
  new HttpError(status, message(key, ctx.locale));
const failWith = (ctx: RouteContext, status: number, key: MessageKey): never => {
  throw httpError(ctx, status, key);
};
const notFound = (ctx: RouteContext): never => {
  throw new HttpError(404, message('notFound', ctx.locale));
};
const data = (ctx: RouteContext): Dataset => ctx.store.dataset;
const requirePermission = (ctx: RouteContext, key: string) => {
  if (!ctx.session?.permissions.includes(key)) throw new HttpError(403, message('forbidden', ctx.locale));
};

let logSeq = 0;
/** 把演示后端里发生的写操作记进操作日志（日志页能看到自己的操作） */
const writeLog = (ctx: RouteContext, action: LogAction, target: string, result: OperationLog['result'] = 'success') => {
  const now = ctx.store.now();
  ctx.store.create('logs', {
    // 时间基 + 进程序号在冻结时钟/重载下都会撞号（锚点相同、logSeq 归零）：补随机后缀保证唯一，
    // 日志页按 id 渲染 key，撞号会破坏受控场景里「跨重载保持」的补丁数据
    id: `LOG-${now.getTime().toString(36).toUpperCase()}-${(logSeq++).toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`,
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

/** 会话是否持有精确设备坐标的数据范围权限（审查 F12） */
const canViewExactCoordinates = (ctx: RouteContext) =>
  !!ctx.session?.permissions.includes('ops.device.coordinate.view');

/** 设备出参统一经过坐标序列化（列表 / 全量 / 详情 / 地图同一条出口） */
const serializeDevice = (ctx: RouteContext, device: Dataset['devices'][number]) =>
  serializeDeviceCoordinates(device, canViewExactCoordinates(ctx));

/** 角色分配权限（审查 F1）：与普通用户资料编辑分离的独立权限点 */
const canAssignRole = (ctx: RouteContext) => !!ctx.session?.permissions.includes('system.user.role.assign');

/**
 * 校验内联的角色分配（审查 F1 第 5、6 条）。三种情形都是授权失败，因此返回真正的 403，
 * 而不是 200 + success:false——调用方（含安全扫描）必须能从状态码直接判定被拒。
 * - 没有 system.user.role.assign 时，请求体里出现 role 一律拒绝；
 * - 任何身份都不得改自己的 role（含管理员），否则被授予该权限的角色可自我提升；
 * - 只能指派 ASSIGNABLE_ROLE_KEYS 内的角色，admin / lead 不在可分配范围；
 * - 目标账号的**当前**角色也必须在可分配范围内：admin / lead 账号既不能被提升到，也不能被降出
 *   （否则委派分配者可以把管理员降成访客；UserForm 对这两类账号只读，这里是同一约束的服务端版本）。
 * 新建用户没有当前角色，target 传 undefined。
 */
const validateRoleAssignment = (ctx: RouteContext, target: User | undefined, role: unknown) => {
  if (!canAssignRole(ctx)) failWith(ctx, 403, 'roleAssignForbidden');
  if (target && target.id === ctx.session?.user?.id) failWith(ctx, 403, 'selfRoleForbidden');
  if (target && !ASSIGNABLE_ROLE_KEYS.includes(target.role)) failWith(ctx, 403, 'roleTargetLocked');
  if (!ROLE_KEYS.includes(role as RoleKey) || !ASSIGNABLE_ROLE_KEYS.includes(role as RoleKey))
    failWith(ctx, 403, 'roleNotAssignable');
};

/**
 * 角色权限写入的提权约束（PUT /roles/:id 与 reset 共用）：
 * - 不能改写 / 重置自己所在的角色：否则持有 system.role.update 的定制角色可以给自己写入全部权限，
 *   reset 也可能把管理员收紧过的权限恢复成更大的默认值。admin 例外——它被锁定为全量，写入只能是原样。
 * - 只能授予自己持有的权限点：新增的 key（目标角色原本没有的）必须在调用者的生效权限里，
 *   否则「先给别的角色加权限、再把傀儡账号分进去」就是一条两步提权。收回或原样保留不算授予。
 */
const guardRolePermissionWrite = (ctx: RouteContext, roleId: RoleKey, current: string[], next: string[]) => {
  if (roleId !== 'admin' && roleId === ctx.session?.roleKey) failWith(ctx, 403, 'selfRoleUpdateForbidden');
  const held = new Set(ctx.session?.permissions ?? []);
  if (next.some((key) => !current.includes(key) && !held.has(key))) failWith(ctx, 403, 'permissionGrantForbidden');
};

/**
 * 权限点列表校验（审查 F8）：必须是 string 数组，拒绝重复、未知与非叶子 key。
 * 结构不合法 → 400；admin 锁不满足 → 403。admin 角色另外要求与 PERMISSION_KEYS 精确 Set 相等——
 * 只比长度会让重复 key 顶替缺失 key，从而在「全量权限」的假象下丢掉真实权限。
 */
const normalizePermissionKeys = (ctx: RouteContext, input: unknown, { exact = false } = {}) => {
  if (!Array.isArray(input)) throw httpError(ctx, 400, 'permissionKeyInvalid');
  const keys: unknown[] = input;
  if (keys.some((key) => typeof key !== 'string')) throw httpError(ctx, 400, 'permissionKeyInvalid');
  const list = keys as string[];
  const unique = new Set(list);
  if (unique.size !== list.length) throw httpError(ctx, 400, 'permissionKeyInvalid');
  if (list.some((key) => !PERMISSION_KEYS.includes(key))) throw httpError(ctx, 400, 'permissionKeyInvalid');
  if (exact && (unique.size !== PERMISSION_KEYS.length || PERMISSION_KEYS.some((key) => !unique.has(key))))
    throw httpError(ctx, 403, 'adminRoleLocked');
  return [...unique];
};

/**
 * 导入请求的整批校验（审查 F2）：在任何写入之前跑完。
 * 结构不合法 → 400，超预算 → 413，且两者都不产生任何写入（没有部分提交）。
 * 预算来自 USER_IMPORT_LIMITS（src/constants/permissions.ts）。注意它**不是**浏览器端
 * XLSX 解析用的那份上限：workbook 预检见 src/pages/Document/Excel/xlsxBoundary.ts 的
 * XLSX_LIMITS，两者管的是「工作簿多大」与「请求体多大」，后者刻意更严。
 */
const validateImportRequest = (ctx: RouteContext): UserImportRow[] => {
  const body = ctx.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(ctx, 400, 'importRequestMalformed');
  let serialized: string;
  try {
    // JSON.stringify 对普通对象一定返回字符串；undefined 只可能来自顶层 undefined，这里已排除
    serialized = JSON.stringify(body) ?? '';
  } catch {
    throw httpError(ctx, 400, 'importRequestMalformed');
  }
  if (!serialized) throw httpError(ctx, 400, 'importRequestMalformed');
  if (Buffer.byteLength(serialized, 'utf8') > USER_IMPORT_LIMITS.maxRequestBodyBytes)
    throw httpError(ctx, 413, 'importBudgetExceeded');
  const rows = (body as Record<string, unknown>).rows;
  if (!Array.isArray(rows)) throw httpError(ctx, 400, 'importRequestMalformed');
  const list: unknown[] = rows;
  if (list.length > USER_IMPORT_LIMITS.maxRows) throw httpError(ctx, 413, 'importBudgetExceeded');
  let totalText = 0;
  list.forEach((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw httpError(ctx, 400, 'importRequestMalformed');
    const entries = Object.entries(row as Record<string, unknown>);
    if (entries.length > USER_IMPORT_LIMITS.maxRowFields) throw httpError(ctx, 413, 'importBudgetExceeded');
    entries.forEach(([key, value]) => {
      // 未知字段一律判非法：导入行只接受 allowlist 内已知形状的字段
      if (!USER_IMPORT_FIELDS.includes(key)) throw httpError(ctx, 400, 'importRequestMalformed');
      // row 是客户端带来的 Excel 行号：只接受非负整数，且不计入文本预算
      if (USER_IMPORT_ROW_FIELDS.includes(key)) {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1_000_000)
          throw httpError(ctx, 400, 'importRequestMalformed');
        return;
      }
      // 字符串字段不接受数组 / 嵌套对象 / 数字 / 布尔
      if (typeof value !== 'string') throw httpError(ctx, 400, 'importRequestMalformed');
      if (value.length > USER_IMPORT_LIMITS.maxFieldLength) throw httpError(ctx, 413, 'importBudgetExceeded');
      totalText += value.length;
    });
  });
  if (totalText > USER_IMPORT_LIMITS.maxTotalTextLength) throw httpError(ctx, 413, 'importBudgetExceeded');
  return list as UserImportRow[];
};

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
  // role 不在这里校验：它不属于 UserInput（角色写入只走 validateRoleAssignment）
  if (input.status !== undefined && !USER_STATUSES.includes(input.status)) fail(ctx, 'notFound');
};

const isProtected = (ctx: RouteContext, user: User) =>
  PROTECTED_USERNAMES.has(user.username) || user.id === ctx.session?.user?.id;

/**
 * admin / lead 账号只由管理员角色维护（口径见 canManageAccount）：单条 PUT / DELETE 与批量接口在任何写入前判定，
 * 不看请求体——启用、原样回传也一样拒绝。这是授权失败，返回真正的 403；体验账号 / 自己的停用删除限制
 * （isProtected）是另一条业务规则，排在它之后。会话的 roleKey 来自用户记录，伪造 token 里的签发角色不起作用。
 */
const guardAccountScope = (ctx: RouteContext, targets: User[]) => {
  if (targets.some((user) => !canManageAccount(ctx.session, user))) failWith(ctx, 403, 'privilegedAccountLocked');
};

/** 新建可携带的字段；角色另经 validateRoleAssignment 判定后合并 */
const USER_WRITE_KEYS = ['name', 'username', 'email', 'department', 'status'] as const;

/**
 * 抽取用户可写字段。role 不在其中（它由调用方在通过 validateRoleAssignment 后单独合并），
 * 因此这里天然不会把未知/越权的角色值带进 store。
 */
const pickUserInput = (ctx: RouteContext, body: Record<string, unknown>) => {
  const input: Partial<UserInput> = {};
  USER_WRITE_KEYS.forEach((key) => {
    // null 不在「未传」语义里：曾绕过校验（String(null)='null' 过正则）后经 store 落成字段删除
    if (body[key] !== undefined && body[key] !== null) (input as Record<string, unknown>)[key] = body[key];
  });
  if (typeof input.username === 'string') input.username = input.username.trim().toLowerCase();
  if (typeof input.name === 'string') input.name = input.name.trim();
  return input;
};

/** 会话展示信息（登录与 currentUser 共用）：角色 + 逐请求解析的权限点 */
const sessionProfile = (session: Session) => ({
  name: session.username,
  nickName: session.user?.name ?? session.username,
  email: session.user?.email ?? '',
  role: session.role,
  roleKey: session.roleKey,
  permissions: session.permissions,
});

/**
 * 工单状态流转：同步响应、完成时刻、关联告警与验收归档。
 * 返工语义（审查 F06）：离开「完成」时，当前生效验收归档进 acceptanceHistory（标注失效时间），
 * 当前验收清空；重新完成后需要一次新的验收。关联告警的恢复时间同步撤销（设备状态由派生规则随之回到故障/离线）。
 *
 * 每次真实的状态变化恰好写一条日志：→ 完成记 ticketClose，离开完成记 ticketRework，
 * todo → doing 记 ticketStart，doing → todo（退回）记 ticketReturn。
 * 起点状态必须在写入前取快照：store.update 原地改记录，写入后 ticket.status 已是新状态。
 */
const moveTicket = (ctx: RouteContext, ticket: Ticket, status: TicketStatus) => {
  const from = ticket.status;
  const now = nowIso(ctx);
  const changes: Partial<Ticket> =
    status === 'todo'
      ? { status, respondedAt: undefined, resolvedAt: undefined }
      : status === 'doing'
        ? { status, respondedAt: ticket.respondedAt ?? now, resolvedAt: undefined }
        : { status, respondedAt: ticket.respondedAt ?? now, resolvedAt: ticket.resolvedAt ?? now };
  if (from === 'done' && status !== 'done' && ticket.acceptance) {
    changes.acceptanceHistory = [
      ...(ticket.acceptanceHistory ?? []),
      {
        ...ticket.acceptance,
        invalidatedAt: now,
        invalidatorName: ctx.session?.user?.name ?? ctx.session?.username ?? '',
      },
    ];
    changes.acceptance = undefined;
  }
  ctx.store.update('tickets', ticket.id, changes);
  if (ticket.alarmId) {
    ctx.store.update('alarms', ticket.alarmId, { recoveredAt: status === 'done' ? changes.resolvedAt : undefined });
  }
  if (from === status) return;
  const action: LogAction =
    status === 'done'
      ? 'ticketClose'
      : from === 'done'
        ? 'ticketRework'
        : status === 'doing'
          ? 'ticketStart'
          : 'ticketReturn';
  writeLog(ctx, action, ticket.id);
};

/** 可派工的处理人：设备所在大区的运维部门在职值班长/工程师 */
const assignableUsers = (ctx: RouteContext, region: string) =>
  data(ctx).users.filter(
    (u) =>
      u.status === 'active' &&
      (u.role === 'operator' || u.role === 'lead') &&
      u.department === REGION_OWNER[region as keyof typeof REGION_OWNER],
  );

/** 会话生效权限（index.ts 的 resolveSession 与登录路由共用）：按用户角色的当前记录解析 */
export const resolvePermissions = (
  dataset: Dataset,
  user: User | undefined,
  tokenRole: DemoRole,
): { roleKey?: RoleKey; permissions: string[] } => {
  if (!user) {
    // 无种子记录的演示登录名：管理员体验给全量，受限体验按访客默认（旧约定，见 token.ts）
    const permissions =
      tokenRole === 'admin' ? [...DEFAULT_ROLE_PERMISSIONS.admin] : [...DEFAULT_ROLE_PERMISSIONS.viewer];
    return { permissions };
  }
  const roleKey = user.role;
  const role = dataset.roles.find((r) => r.id === roleKey);
  // 管理员角色受保护恒为全量；其余按记录现算（改权限立即生效），记录缺失回落默认、不放大为全量
  const permissions =
    roleKey === 'admin'
      ? [...DEFAULT_ROLE_PERMISSIONS.admin]
      : [...(role?.permissions ?? DEFAULT_ROLE_PERMISSIONS[roleKey])];
  return { roleKey, permissions };
};

/** 设备读路径统一按可用性规则派生状态（F07：列表、详情、地图、KPI 同一口径） */
const applyDeviceStatus = (ctx: RouteContext) => {
  const dataset = data(ctx);
  return applyDerivedStatus(dataset.devices, dataset.alarms, ctx.store.now().toISOString());
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
      // 演示约定：种子用户按其角色签发（管理员才有管理权限）；其余任意用户名放行为管理员，受限体验名除外。
      // 权限点在每次请求时按角色记录解析（见 index.ts resolveSession），改权限对已有会话立即生效。
      const role: DemoRole = user ? (user.role === 'admin' ? 'admin' : 'user') : demoRoleFor(name);
      const session: Session = {
        username: user?.username ?? name,
        role,
        user,
        ...resolvePermissions(data(ctx), user, role),
      };
      if (user) {
        ctx.store.update('users', user.id, { lastLoginAt: nowIso(ctx), lastLoginIp: '192.0.2.10' });
      }
      writeLog({ ...ctx, session }, 'login', '');
      return {
        token: issueDemoToken(session.username, role),
        user: sessionProfile(session),
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/currentUser',
    handle: ({ session }) => sessionProfile(session!),
  },
  {
    method: 'POST',
    path: '/api/v1/logout',
    handle: (ctx) => {
      writeLog(ctx, 'logout', '');
      return null;
    },
  },

  // ------------------------------------------------ 用户
  {
    method: 'GET',
    path: '/api/v1/users',
    access: 'system.user.view',
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
  {
    method: 'GET',
    path: '/api/v1/users/:id',
    access: 'system.user.view',
    handle: (ctx) => findUser(ctx, ctx.params.id),
  },
  {
    method: 'POST',
    path: '/api/v1/users',
    access: 'system.user.create',
    handle: (ctx) => {
      const input = pickUserInput(ctx, ctx.body);
      validateUser(ctx, { name: '', username: '', email: '', ...input });
      // 角色只在新建时可指定；指定即视为一次角色分配，需要独立的 role.assign 权限
      if (ctx.body.role !== undefined) validateRoleAssignment(ctx, undefined, ctx.body.role);
      const maxId = Math.max(...data(ctx).users.map((u) => Number(u.id.slice(1)) || 0), 1000);
      const user: User = {
        id: `U${maxId + 1}`,
        name: input.name!,
        username: input.username!,
        email: input.email!,
        phone: '',
        department: (input.department ?? 'support') as DepartmentKey,
        role: (ctx.body.role ?? 'viewer') as RoleKey,
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
    access: 'system.user.update',
    handle: (ctx) => {
      const user = findUser(ctx, ctx.params.id);
      guardAccountScope(ctx, [user]);
      const assigningRole = ctx.body.role !== undefined;
      // 角色分配与资料编辑分离（审查 F1）：
      // 1) 没有 system.user.role.assign → 403，无论目标是哪个用户；
      // 2) 任何身份（含持有该权限者）都不得改自己的 role；
      // 3) 指派范围受 ASSIGNABLE_ROLE_KEYS 限制，且两次校验都在写入之前。
      if (assigningRole && !canAssignRole(ctx)) failWith(ctx, 403, 'roleAssignForbidden');
      if (assigningRole) validateRoleAssignment(ctx, user, ctx.body.role);
      const input = pickUserInput(ctx, ctx.body);
      validateUser(ctx, input, user.id);
      if (input.status && input.status !== 'active' && isProtected(ctx, user)) fail(ctx, 'protectedAccount');
      // 会话按登录名解析（token 里只有登录名）：改掉自己的登录名会让当前会话失去用户记录，
      // 之后再建同名账号还会让旧 token 指向新账号。原样回传自己的登录名（整表单提交）不算改名。
      if (user.id === ctx.session?.user?.id && input.username !== undefined && input.username !== user.username)
        fail(ctx, 'selfRenameForbidden');
      if (PROTECTED_USERNAMES.has(user.username)) delete input.username;
      // 变化判定必须在写入前取快照：store.update 是原地改记录，user 与 updated 是同一个对象，
      // 写入后再比较会永远相等（日志永远不写）
      const previousRole = user.role;
      const updated = ctx.store.update('users', user.id, {
        ...input,
        ...(assigningRole ? { role: ctx.body.role as RoleKey } : {}),
      })!;
      // 只有真的发生角色变化才记 roleAssign；目标不存在时上面的 notFound 已先行抛错
      if (assigningRole && ctx.body.role !== previousRole)
        writeLog(ctx, 'userRoleAssign', `${user.username}→${updated.role}`);
      writeLog(ctx, input.status === 'disabled' ? 'userDisable' : 'userUpdate', updated.name);
      return updated;
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/users/:id',
    access: 'system.user.delete',
    handle: (ctx) => {
      const user = findUser(ctx, ctx.params.id);
      guardAccountScope(ctx, [user]);
      if (isProtected(ctx, user)) fail(ctx, 'protectedAccount');
      ctx.store.remove('users', user.id);
      writeLog(ctx, 'userDelete', user.name);
      return user.id;
    },
  },
  {
    method: 'POST',
    path: '/api/v1/users/batch',
    access: 'system.user.update',
    handle: (ctx) => {
      const ids = Array.isArray(ctx.body.ids) ? (ctx.body.ids as string[]) : [];
      const action = ctx.body.action as UserBatchAction;
      // 枚举先行：任意值曾被 `as` 直通，'banana' 之类会静默把整批用户禁用并写出无 action 的日志
      if (!BATCH_LOG_ACTION[action]) failWith(ctx, 400, 'actionInvalid');
      if (action === 'delete') requirePermission(ctx, 'system.user.delete');
      const users = ids.map((id) => findUser(ctx, id));
      // 整批判定、先于任何写入：混入一个 admin / lead 账号整批 403，不会先处理前面的普通账号（启用同样算）
      guardAccountScope(ctx, users);
      if (action !== 'enable' && users.some((u) => isProtected(ctx, u))) fail(ctx, 'protectedAccount');
      users.forEach((user) => {
        if (action === 'delete') {
          ctx.store.remove('users', user.id);
        } else {
          ctx.store.update('users', user.id, { status: action === 'enable' ? 'active' : 'disabled' });
        }
        // 批量动作与单条 DELETE/PUT 用同一套 action 名（审查 N7）：
        // 否则「按 userDelete 过滤」会漏掉批量删除，日志筛选口径与操作语义不一致
        writeLog(ctx, BATCH_LOG_ACTION[action], user.name);
      });
      return users.length;
    },
  },
  {
    // Excel 批量导入（F04）：服务端逐行复核，准确报告创建/重复/无效计数，不重复写入
    method: 'POST',
    path: '/api/v1/users/import',
    access: 'system.user.create',
    handle: (ctx) => {
      // 请求级预算与整批校验先跑完（审查 F2）：之后才允许任何写入，
      // 结构非法的请求永远不会留下「前面几行已提交」的部分状态。
      const rows = validateImportRequest(ctx);
      if (!rows.length) fail(ctx, 'notFound');
      /**
       * 角色列语义（契约见 UserImportRow.role）：缺省、空串或纯空白 = 未指定，按默认角色 viewer 创建，
       * 不构成角色分配；非空值才是一次角色分配，且只接受角色 key（中英文标签由客户端映射成 key）。
       * 角色分配是独立权限（审查 F1）：只要有一行指定了角色，就与 POST /users 同一口径判权限，
       * 缺权限整批 403。否则「导入」会变成绕过 system.user.role.assign 的第二条角色写入通道，
       * 新权限点就形同虚设（授权失败不该被降级成「某几行无效」）。
       */
      const roleOf = (row: UserImportRow) =>
        typeof row.role === 'string' && row.role.trim() ? row.role.trim() : undefined;
      if (rows.some((row) => roleOf(row) !== undefined) && !canAssignRole(ctx))
        failWith(ctx, 403, 'roleAssignForbidden');
      const existing = new Set(data(ctx).users.map((u) => u.username.toLowerCase()));
      const result: UserImportResult = { created: 0, duplicated: 0, invalid: 0, createdIds: [], issues: [], users: [] };
      const seenInFile = new Set<string>();
      rows.forEach((row, index) => {
        // 报告用客户端带来的 Excel 行号（只用于对账展示，不写进记录）：客户端只提交本地校验通过的行，
        // 且解析时会跳过空行，按下标推算会与预览错位；缺省时才退回「表头占第 1 行」的推算
        const rowNo = row.row ?? index + 2;
        const username = String(row.username ?? '')
          .trim()
          .toLowerCase();
        const input = pickUserInput(ctx, row as Record<string, unknown>);
        const problems: string[] = [];
        if (!input.name?.trim()) problems.push(message('nameRequired', ctx.locale));
        if (!/^[a-z][a-z0-9._-]{2,31}$/.test(username)) problems.push(message('usernameRequired', ctx.locale));
        if (input.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email)))
          problems.push(message('emailInvalid', ctx.locale));
        if (input.department !== undefined && !DEPARTMENT_KEYS.includes(input.department as DepartmentKey))
          problems.push(message('notFound', ctx.locale));
        // 携带 role 的导入行同样受 role.assign 约束（见上方整批判定）；
        // 有权限时再逐行校验可分配范围：越界只让该行 invalid，不影响同批其他行
        const role = roleOf(row);
        if (role !== undefined && !ASSIGNABLE_ROLE_KEYS.includes(role as RoleKey))
          problems.push(message('roleNotAssignable', ctx.locale));
        if (problems.length) {
          result.invalid += 1;
          result.issues.push({ row: rowNo, reason: 'invalid', message: problems.join('；') });
          return;
        }
        if (existing.has(username) || seenInFile.has(username)) {
          result.duplicated += 1;
          result.issues.push({ row: rowNo, reason: 'duplicate', message: message('usernameTaken', ctx.locale) });
          return;
        }
        seenInFile.add(username);
        const maxId = Math.max(...data(ctx).users.map((u) => Number(u.id.slice(1)) || 0), 1000);
        const user: User = {
          id: `U${maxId + 1}`,
          name: input.name!,
          username,
          email: input.email ?? `${username}@example.com`,
          phone: '',
          department: (input.department ?? 'support') as DepartmentKey,
          role: (role ?? 'viewer') as RoleKey,
          status: 'active',
          createdAt: nowIso(ctx),
        };
        ctx.store.create('users', user);
        existing.add(username);
        result.created += 1;
        result.createdIds.push(user.id);
        result.users.push(user);
      });
      writeLog(ctx, 'userImport', `+${result.created}`);
      return result;
    },
  },

  // ------------------------------------------------ 角色
  {
    method: 'GET',
    path: '/api/v1/roles',
    access: 'system.role.view',
    handle: (ctx) =>
      data(ctx).roles.map((role) => ({
        ...role,
        memberCount: data(ctx).users.filter((u) => u.role === role.id).length,
      })),
  },
  {
    method: 'PUT',
    path: '/api/v1/roles/:id',
    access: 'system.role.update',
    handle: (ctx) => {
      const role = data(ctx).roles.find((r) => r.id === ctx.params.id) ?? notFound(ctx);
      // 审查 F8：集合等价校验，不是长度校验——重复 / 未知 / 非叶子 key 一律拒绝，
      // admin 必须与 PERMISSION_KEYS 精确相等，其余角色也要归一化去重后再落库
      const permissions = normalizePermissionKeys(ctx, ctx.body.permissions, { exact: role.id === 'admin' });
      guardRolePermissionWrite(ctx, role.id, role.permissions, permissions);
      const updated = ctx.store.update('roles', role.id, { permissions, updatedAt: nowIso(ctx) })!;
      writeLog(ctx, 'roleUpdate', ROLE_NAMES[role.id][ctx.locale === 'en-US' ? 'en' : 'zh']);
      return { ...updated, memberCount: data(ctx).users.filter((u) => u.role === role.id).length };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/roles/:id/reset',
    access: 'system.role.update',
    handle: (ctx) => {
      const role = data(ctx).roles.find((r) => r.id === ctx.params.id) ?? notFound(ctx);
      // reset 等价于一次写入默认值：同样受「不改自己角色 / 只授予自己持有的权限」约束
      guardRolePermissionWrite(ctx, role.id, role.permissions, DEFAULT_ROLE_PERMISSIONS[role.id]);
      ctx.store.update('roles', role.id, {
        permissions: [...DEFAULT_ROLE_PERMISSIONS[role.id]],
        updatedAt: nowIso(ctx),
      });
      // 审查 F7：角色 reset 是特权 mutation，必须留痕（含 actor / action / target / time / result）
      writeLog(ctx, 'roleReset', ROLE_NAMES[role.id][ctx.locale === 'en-US' ? 'en' : 'zh']);
      return null;
    },
  },

  // ------------------------------------------------ 操作日志
  {
    method: 'GET',
    path: '/api/v1/logs',
    access: 'system.log.view',
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
    access: 'ops.device.view',
    handle: (ctx) => {
      const { keyword, region, status, model } = ctx.query;
      const derived = applyDeviceStatus(ctx);
      const list = derived.filter(
        (d) =>
          matches(keyword, d.name, d.id, d.city) &&
          (!region || d.region === region) &&
          (!status || d.status === status) &&
          (!model || d.model === model),
      );
      return paginate(serializeDeviceListCoordinates(list, canViewExactCoordinates(ctx)), ctx.query);
    },
  },
  {
    method: 'GET',
    path: '/api/v1/devices/all',
    access: 'ops.device.view',
    handle: (ctx) => serializeDeviceListCoordinates(applyDeviceStatus(ctx), canViewExactCoordinates(ctx)),
  },
  {
    method: 'GET',
    path: '/api/v1/devices/:id',
    access: 'ops.device.view',
    handle: (ctx) => {
      const derived = applyDeviceStatus(ctx);
      const device = derived.find((d) => d.id === ctx.params.id) ?? notFound(ctx);
      return {
        ...serializeDevice(ctx, device),
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
    access: 'ops.alarm.view',
    handle: (ctx) => {
      const { keyword, deviceId, level, type, status, unrecovered, region, from, to } = ctx.query;
      const list = data(ctx).alarms.filter((a) => {
        if (unrecovered === true || unrecovered === 'true') {
          // 只看未恢复（F08）：按业务恢复语义筛选——活动 + 已转工单但未恢复；
          // recovered / falsePositive / 已随工单完成恢复的不在内
          if (a.status !== 'active' && !(a.status === 'ticketed' && !a.recoveredAt)) return false;
        }
        return (
          matches(keyword, a.id, a.deviceName, a.city) &&
          (!deviceId || a.deviceId === deviceId) &&
          (!level || a.level === level) &&
          (!type || a.type === type) &&
          (!status || a.status === status) &&
          (!region || a.region === region) &&
          inRange(a.occurredAt, from, to)
        );
      });
      return paginate(list, ctx.query);
    },
  },
  {
    method: 'POST',
    path: '/api/v1/alarms/:id/handle',
    access: 'ops.alarm.handle',
    handle: (ctx) => {
      const alarm = data(ctx).alarms.find((a) => a.id === ctx.params.id) ?? notFound(ctx);
      if (alarm.status !== 'active') fail(ctx, 'alarmClosed');
      const action = ctx.body.action as AlarmHandleAction;
      // 枚举校验：未知值曾被 else 分支一律按「误报」关单并写 misleading 日志
      if (action !== 'ticket' && action !== 'recover' && action !== 'falsePositive') {
        failWith(ctx, 400, 'actionInvalid');
      }
      const now = nowIso(ctx);
      if (action === 'ticket') {
        const device = data(ctx).devices.find((d) => d.id === alarm.deviceId)!;
        // 指派：显式指定的处理人（须为该大区可派工人员）优先，否则会话用户（若可派工），否则按大区规则取第一位
        const requested = String(ctx.body.assigneeId ?? '');
        const pool = assignableUsers(ctx, device.region);
        const assignee =
          pool.find((u) => u.id === requested) ??
          (ctx.session?.user && pool.some((u) => u.id === ctx.session!.user!.id) ? ctx.session.user : undefined) ??
          pool[0] ??
          data(ctx).users[0]!;
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
    access: 'ops.ticket.view',
    handle: (ctx) => {
      const { status, board, keyword, priority, kind, deviceId, from, to } = ctx.query;
      const since = ctx.store.now().getTime() - BOARD_DONE_DAYS * DAY;
      const list = data(ctx).tickets.filter(
        (t) =>
          (!status || t.status === status) &&
          (!priority || t.priority === priority) &&
          (!kind || t.kind === kind) &&
          (!deviceId || t.deviceId === deviceId) &&
          matches(keyword, t.id, t.deviceName, t.title, t.city) &&
          inRange(t.createdAt, from, to) &&
          (!board || board === 'false' || t.status !== 'done' || new Date(t.resolvedAt!).getTime() >= since),
      );
      return paginate(list, { pageSize: board ? 200 : 20, ...ctx.query });
    },
  },
  {
    // 按 ID 独立加载（F03）：历史工单深链接不依赖看板「近三天完成」窗口
    method: 'GET',
    path: '/api/v1/tickets/:id',
    access: 'ops.ticket.view',
    handle: (ctx) => data(ctx).tickets.find((t) => t.id === ctx.params.id) ?? notFound(ctx),
  },
  {
    method: 'PUT',
    path: '/api/v1/tickets/:id',
    access: 'ops.ticket.view',
    handle: (ctx) => {
      const ticket = data(ctx).tickets.find((t) => t.id === ctx.params.id) ?? notFound(ctx);
      // 状态流转按目标状态区分权限：开工/完成为处理权限；退回/重派为派工权限
      const status = ctx.body.status as TicketStatus | undefined;
      if (status && status !== ticket.status) {
        if (status === 'todo' || ticket.status === 'done') requirePermission(ctx, 'ops.ticket.assign');
        else requirePermission(ctx, 'ops.ticket.close');
        moveTicket(ctx, ticket, status);
      }
      // 改派处理人（派工权限）
      const assigneeId = String(ctx.body.assigneeId ?? '');
      if (assigneeId && assigneeId !== ticket.assigneeId) {
        requirePermission(ctx, 'ops.ticket.assign');
        const assignee = data(ctx).users.find(
          (u) => u.id === assigneeId && u.status === 'active' && (u.role === 'operator' || u.role === 'lead'),
        );
        if (!assignee) fail(ctx, 'notFound');
        ctx.store.update('tickets', ticket.id, { assigneeId: assignee!.id, assigneeName: assignee!.name });
        writeLog(ctx, 'ticketAssign', ticket.id);
      }
      return data(ctx).tickets.find((t) => t.id === ticket.id);
    },
  },
  {
    method: 'POST',
    path: '/api/v1/tickets/:id/rework',
    access: 'ops.ticket.assign',
    handle: (ctx) => {
      const ticket = data(ctx).tickets.find((t) => t.id === ctx.params.id) ?? notFound(ctx);
      if (ticket.status !== 'done') fail(ctx, 'ticketNotDone');
      moveTicket(ctx, ticket, 'doing');
      return data(ctx).tickets.find((t) => t.id === ticket.id);
    },
  },
  {
    method: 'POST',
    path: '/api/v1/tickets/:id/acceptance',
    access: 'ops.ticket.accept',
    handle: (ctx) => {
      const ticket = data(ctx).tickets.find((t) => t.id === ctx.params.id) ?? notFound(ctx);
      if (ticket.status !== 'done') fail(ctx, 'ticketNotDone');
      if (ticket.acceptance) fail(ctx, 'ticketAccepted');
      // 审查 F11：与浏览器渲染 / 下载共用同一个强校验器（PNG magic + IHDR + 尺寸 + chunk CRC）。
      // 只判前缀与长度会把畸形载荷持久化成「已验收」，状态变更前必须整份校验通过。
      // fail 返回 never，`??` 因此在类型上把 signature 收窄为 string
      const signature = safeSignature(ctx.body.signature) ?? fail(ctx, 'signatureInvalid');
      const updated = ctx.store.update('tickets', ticket.id, {
        acceptance: {
          signerName: ctx.session?.user?.name ?? ctx.session?.username ?? '',
          signedAt: nowIso(ctx),
          signature,
        },
      })!;
      writeLog(ctx, 'ticketAccept', ticket.id);
      return updated;
    },
  },

  // ------------------------------------------------ 工作台
  {
    method: 'GET',
    path: '/api/v1/dashboard/overview',
    access: 'dashboard.view',
    handle: (ctx) => buildOverview(data(ctx), ctx.store.now()),
  },

  // ------------------------------------------------ 日程
  {
    method: 'GET',
    path: '/api/v1/events',
    handle: (ctx) => data(ctx).events.filter((e) => inRange(e.start, ctx.query.from, ctx.query.to)),
  },
  {
    method: 'POST',
    path: '/api/v1/events',
    access: 'ops.schedule.update',
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
      // 审查 F7：日程是特权 mutation，成功创建才留痕
      writeLog(ctx, 'scheduleCreate', event.id);
      return event;
    },
  },
  {
    method: 'PUT',
    path: '/api/v1/events/:id',
    access: 'ops.schedule.update',
    handle: (ctx) => {
      const event = data(ctx).events.find((e) => e.id === ctx.params.id) ?? notFound(ctx);
      const changes: Partial<CalendarEvent> = {};
      const body = ctx.body;
      const hasValue = (value: unknown): value is NonNullable<unknown> => value !== undefined && value !== null;
      // 部分更新复用 POST 的校验口径（修复前 PUT 直通：{title:null} 删标题、'garbage' 也能当日期）。
      // title/type/start 不可清空：出现即必须是合法值；end 允许显式清空（去掉结束时间）。
      if ('title' in body) {
        const { title } = body;
        if (typeof title !== 'string' || !title.trim()) fail(ctx, 'titleRequired');
        changes.title = (title as string).trim();
      }
      if ('type' in body && hasValue(body.type)) {
        if (!EVENT_TYPES.includes(body.type as EventType)) fail(ctx, 'notFound');
        changes.type = body.type as EventType;
      }
      if ('start' in body && hasValue(body.start)) {
        if (Number.isNaN(new Date(String(body.start)).getTime())) fail(ctx, 'notFound');
        changes.start = String(body.start);
      }
      if ('end' in body && hasValue(body.end)) {
        if (Number.isNaN(new Date(String(body.end)).getTime())) fail(ctx, 'notFound');
        changes.end = String(body.end);
      } else if ('end' in body) {
        changes.end = undefined;
      }
      if ('allDay' in body && hasValue(body.allDay)) changes.allDay = !!body.allDay;
      const effectiveStart = changes.start !== undefined ? new Date(changes.start) : new Date(event.start);
      const effectiveEnd =
        changes.end !== undefined ? new Date(changes.end) : event.end ? new Date(event.end) : undefined;
      if (effectiveEnd && effectiveStart.getTime() > effectiveEnd.getTime()) fail(ctx, 'notFound');
      const updated = ctx.store.update('events', event.id, changes);
      writeLog(ctx, 'scheduleUpdate', event.id);
      return updated;
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/events/:id',
    access: 'ops.schedule.update',
    handle: (ctx) => {
      const { id } = ctx.params;
      // 目标不存在时 notFound 先行抛错，不会留下「成功」的假日志
      if (!ctx.store.remove('events', id)) notFound(ctx);
      writeLog(ctx, 'scheduleDelete', id);
      return id;
    },
  },

  // ------------------------------------------------ 演示数据与演示时钟
  {
    // 重置/进入/退出场景不写操作日志：它们本身会清空补丁，重置后再补一条日志反而造成数量漂移（D03）
    method: 'POST',
    path: '/api/v1/demo/reset',
    access: 'system.demo.reset',
    handle: (ctx) => {
      ctx.store.reset();
      // 受控演示模式下重置 = 重新锚定到当前时刻（再次演示无需修数据）
      if (demoClock.snapshot().mode === 'frozen') demoClock.freeze();
      return null;
    },
  },
  {
    // 读时钟公开（登录页顶栏也要展示受控标记）：需要登录会在未登录时触发 401 →
    // 请求层整页跳登录并丢失 redirect 参数（2026-10-12 整改中真实踩到）
    method: 'GET',
    path: '/api/v1/demo/clock',
    access: 'public',
    handle: () => {
      const snapshot = demoClock.snapshot();
      return { mode: snapshot.mode, anchor: snapshot.anchor, demoTime: demoClock.now().toISOString() };
    },
  },
  {
    // 登录页的三个数字：与工作台 KPI 同一聚合（此前是写死的故事常量，与进门后看到的数字对不上）。
    // 免登录，只返回聚合计数，不含任何明细
    method: 'GET',
    path: '/api/v1/demo/snapshot',
    access: 'public',
    handle: (ctx) => {
      const { kpi } = buildOverview(data(ctx), ctx.store.now());
      return {
        devicesOnline: kpi.devicesOnline,
        devicesTotal: kpi.devicesTotal,
        alarmsToday: kpi.alarmsToday,
        slaRate: kpi.slaRate,
      };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/demo/clock',
    access: 'system.demo.reset',
    handle: (ctx) => {
      const mode = String(ctx.body.mode ?? '');
      if (mode === 'live') demoClock.resume();
      else if (mode === 'frozen') demoClock.freeze(typeof ctx.body.ts === 'number' ? ctx.body.ts : undefined);
      else fail(ctx, 'notFound');
      ctx.store.syncFromStorage();
      // 审查 F7：演示时钟变更影响全站数据口径，必须留痕（demo/reset 与 scenario 不记，
      // 它们自身会清空补丁与日志表，写进去的条目随即被 reset 抹掉，属于设计约定见该路由注释）
      writeLog(ctx, 'demoClock', mode);
      return {
        mode: demoClock.snapshot().mode,
        anchor: demoClock.snapshot().anchor,
        demoTime: demoClock.now().toISOString(),
      };
    },
  },
  {
    // 进入/退出固定演示场景（D04）：进入 = 冻结时钟 + 清空补丁（场景初始态）；退出 = 回实时 + 清空补丁
    method: 'POST',
    path: '/api/v1/demo/scenario',
    access: 'system.demo.reset',
    handle: (ctx) => {
      const action = String(ctx.body.action ?? '');
      if (action === 'enter') demoClock.freeze();
      else if (action === 'exit') demoClock.resume();
      else fail(ctx, 'notFound');
      ctx.store.reset();
      return { mode: demoClock.snapshot().mode, demoTime: demoClock.now().toISOString() };
    },
  },
];
