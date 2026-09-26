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
  titleRequired: { zh: '请填写标题', en: 'Title is required' },
} as const;

export type MessageKey = keyof typeof MESSAGES;

export const message = (key: MessageKey, locale: DemoLocale) => MESSAGES[key][locale === 'en-US' ? 'en' : 'zh'];
