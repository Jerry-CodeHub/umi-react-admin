import type { DemoLocale } from '../generate';

/** 演示后端的错误提示（真实后端同样应按请求语言返回可直接展示的 message） */
const MESSAGES = {
  usernameRequired: { zh: '请输入用户名', en: 'Username is required' },
  unauthorized: { zh: '未登录或登录已失效', en: 'Not signed in or the session has expired' },
  forbidden: { zh: '当前账号没有该操作的权限', en: 'Your account is not allowed to do this' },
  notFound: { zh: '请求的资源不存在', en: 'The requested resource does not exist' },
  accountDisabled: { zh: '账号已停用，请联系管理员', en: 'This account is disabled. Contact an administrator' },
  accountLocked: {
    zh: '账号已锁定（连续多次密码错误），请联系管理员',
    en: 'This account is locked after repeated failed sign-ins. Contact an administrator',
  },
  usernameTaken: { zh: '登录名已被占用', en: 'This username is already taken' },
  emailInvalid: { zh: '邮箱格式不正确', en: 'The email address is not valid' },
  nameRequired: { zh: '请填写姓名', en: 'Name is required' },
  protectedAccount: {
    zh: '体验账号与当前登录账号不能停用或删除',
    en: 'Demo accounts and the signed-in account cannot be disabled or deleted',
  },
  adminRoleLocked: {
    zh: '系统管理员角色必须保留全部权限',
    en: 'The administrator role must keep every permission',
  },
  alarmClosed: { zh: '该告警已处置', en: 'This alarm has already been handled' },
  ticketNotDone: { zh: '工单完成后才能验收签字', en: 'A ticket can only be signed off after it is done' },
  ticketAccepted: {
    zh: '该工单已有生效验收，返工后才能重新验收',
    en: 'This ticket already has a valid acceptance; rework it first',
  },
  signatureInvalid: { zh: '签名格式不正确', en: 'The signature format is invalid' },
  titleRequired: { zh: '请填写标题', en: 'Title is required' },
  roleAssignForbidden: {
    zh: '当前账号没有分配角色的权限',
    en: 'Your account is not allowed to assign roles',
  },
  selfRoleForbidden: {
    zh: '不能修改自己的角色',
    en: 'You cannot change your own role',
  },
  roleNotAssignable: {
    zh: '该角色不在可分配范围内',
    en: 'That role is outside the assignable range',
  },
  roleTargetLocked: {
    zh: '管理员与值班长账号的角色不能通过此通道变更',
    en: 'Administrator and shift-lead accounts cannot have their role changed here',
  },
  selfRoleUpdateForbidden: {
    zh: '不能修改或重置自己所在角色的权限',
    en: 'You cannot change or reset the permissions of your own role',
  },
  permissionGrantForbidden: {
    zh: '不能授予自己未持有的权限',
    en: 'You cannot grant permissions you do not hold yourself',
  },
  privilegedAccountLocked: {
    zh: '管理员与值班长账号只能由系统管理员停用、删除或修改资料',
    en: 'Only an administrator can disable, delete, or edit administrator and shift-lead accounts',
  },
  selfRenameForbidden: {
    zh: '不能修改当前登录账号的登录名',
    en: 'You cannot change the username of the signed-in account',
  },
  permissionKeyInvalid: {
    zh: '权限列表包含重复、未知或非叶子权限点',
    en: 'The permission list contains duplicate, unknown, or non-leaf keys',
  },
  importBudgetExceeded: {
    zh: '导入数据超出服务端上限（行数、字段数、单字段长度或文本总量）',
    en: 'The import exceeds the server limits (rows, fields, field length, or total text)',
  },
  importRequestMalformed: {
    zh: '导入请求结构不合法，未写入任何数据',
    en: 'The import request is malformed; nothing was written',
  },
  actionInvalid: {
    zh: '操作类型不在支持范围内',
    en: 'The action is not one of the supported kinds',
  },
} as const;

export type MessageKey = keyof typeof MESSAGES;

export const message = (key: MessageKey, locale: DemoLocale) => MESSAGES[key][locale === 'en-US' ? 'en' : 'zh'];
