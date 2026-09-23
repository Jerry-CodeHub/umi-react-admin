import type { Request, Response } from 'express';
// ⚠️ 这是开发环境的演示 mock（仅 `max dev` 生效，不进生产产物）。
// 禁止把本文件当作真实后端的参考实现：登录不校验密码、token 是客户端可随意构造的
// 演示约定（见 src/services/demo/demoToken.ts 的警告）——搬进真实后端等于接受万能凭证。
//
// 注意：umi 会把 mock/ 下所有 .ts/.js 当作 mock 文件加载（mock/**/*.[jt]s），
// 测试与共享逻辑不要放在这里——查询逻辑在 src/services/demo/userQuery.ts，与静态演示层共用。
import { demoRoleFor, issueDemoToken, verifyDemoToken } from '../src/services/demo/demoToken';
import { filterAndPaginate, type DemoUserRecord } from '../src/services/demo/userQuery';

let users: DemoUserRecord[] = [
  { id: '0', name: 'Umi', nickName: 'U', gender: 'MALE', email: 'umi@example.com' },
  { id: '1', name: 'Fish', nickName: 'B', gender: 'FEMALE', email: 'fish@example.com' },
];

/** 过滤掉 undefined 字段，防止未出现在表单里的字段被 undefined 覆盖（双保险，前端提交层已挑拣） */
const filterUndefined = (body: unknown): Record<string, unknown> =>
  Object.fromEntries(Object.entries((body as Record<string, unknown>) || {}).filter(([, v]) => v !== undefined));

export default {
  // 演示登录：任意用户名/密码放行；dontHaveAccess 为约定的「可登录但无管理权限」演示账号
  'POST /api/v1/login': (req: Request, res: Response) => {
    const { name } = (req.body || {}) as { name?: string };
    if (!name) {
      res.status(400).json({ success: false, errorCode: 400, message: '请输入用户名' });
      return;
    }
    res.json({
      success: true,
      data: {
        token: issueDemoToken(name),
        user: { name, nickName: name, email: '', role: demoRoleFor(name) },
      },
      errorCode: 0,
    });
  },
  'GET /api/v1/currentUser': (req: Request, res: Response) => {
    const authorization = (req.headers && req.headers.authorization) || '';
    const matched = /^Bearer (.+)$/.exec(authorization);
    const payload = matched ? verifyDemoToken(matched[1]) : null;
    if (!payload) {
      res.status(401).json({ success: false, errorCode: 401, message: '未登录或登录已失效' });
      return;
    }
    res.json({
      success: true,
      data: { name: payload.name, nickName: payload.name, email: '', role: payload.role },
      errorCode: 0,
    });
  },
  'POST /api/v1/logout': (_req: Request, res: Response) => {
    res.json({ success: true, data: null, errorCode: 0 });
  },
  'GET /api/v1/queryUserList': (req: Request, res: Response) => {
    const { current, pageSize, keyword, name, nickName, gender } = (req.query || {}) as Record<
      string,
      string | undefined
    >;
    res.json({
      success: true,
      data: filterAndPaginate(users, { current, pageSize, keyword, name, nickName, gender }),
      errorCode: 0,
    });
  },
  'GET /api/v1/user/:userId': (req: Request, res: Response) => {
    const { userId } = req.params;
    const user = users.find((item) => item.id === userId);
    if (!user) {
      res.status(404).json({ success: false, errorCode: 404, message: '用户不存在' });
      return;
    }
    res.json({ success: true, data: user, errorCode: 0 });
  },
  'POST /api/v1/user': (req: Request, res: Response) => {
    const user = {
      id: `${Date.now()}`,
      gender: 'MALE',
      ...filterUndefined(req.body),
    } as DemoUserRecord;
    users = [user, ...users];
    res.json({
      success: true,
      data: user,
      errorCode: 0,
    });
  },
  'PUT /api/v1/user/:userId': (req: Request, res: Response) => {
    const { userId } = req.params;
    const index = users.findIndex((user) => user.id === userId);
    if (index < 0) {
      res.status(404).json({
        success: false,
        errorCode: 404,
        message: '用户不存在',
      });
      return;
    }

    users[index] = {
      ...users[index],
      ...filterUndefined(req.body),
    };
    res.json({
      success: true,
      data: users[index],
      errorCode: 0,
    });
  },
  'DELETE /api/v1/user/:userId': (req: Request, res: Response) => {
    const { userId } = req.params;
    users = users.filter((user) => user.id !== userId);
    res.json({
      success: true,
      data: userId,
      errorCode: 0,
    });
  },
};
