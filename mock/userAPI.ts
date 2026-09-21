import type { Request, Response } from 'express';

let users = [
  { id: '0', name: 'Umi', nickName: 'U', gender: 'MALE', email: 'umi@example.com' },
  { id: '1', name: 'Fish', nickName: 'B', gender: 'FEMALE', email: 'fish@example.com' },
];

export type DemoUserRecord = {
  id: string;
  name: string;
  nickName: string;
  gender: string;
  email: string;
};

/** 过滤（keyword/gender）+ 分页（current/pageSize，含缺省），供 handler 与单测共用 */
export function filterAndPaginate(
  users: DemoUserRecord[],
  options: { current?: number | string; pageSize?: number | string; keyword?: string; gender?: string },
) {
  const { current = 1, pageSize = 20, keyword, gender } = options;
  let list = keyword ? users.filter((user) => user.name.includes(keyword) || user.nickName.includes(keyword)) : users;
  if (gender) {
    list = list.filter((user) => user.gender === gender);
  }
  const start = (Number(current) - 1) * Number(pageSize);
  return {
    current: Number(current),
    pageSize: Number(pageSize),
    total: list.length,
    list: list.slice(start, start + Number(pageSize)),
  };
}

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
        token: `${name}-demo-token`,
        user: { name, nickName: name, email: '' },
      },
      errorCode: 0,
    });
  },
  'GET /api/v1/currentUser': (req: Request, res: Response) => {
    const authorization = (req.headers && req.headers.authorization) || '';
    const matched = /^Bearer (.+)-demo-token$/.exec(authorization);
    if (!matched) {
      res.status(401).json({ success: false, errorCode: 401, message: '未登录或登录已失效' });
      return;
    }
    const name = matched[1];
    res.json({
      success: true,
      data: { name, nickName: name, email: '' },
      errorCode: 0,
    });
  },
  'POST /api/v1/logout': (_req: Request, res: Response) => {
    res.json({ success: true, data: null, errorCode: 0 });
  },
  'GET /api/v1/queryUserList': (req: Request, res: Response) => {
    const {
      current = 1,
      pageSize = 20,
      keyword,
      gender,
    } = (req.query || {}) as {
      current?: string;
      pageSize?: string;
      keyword?: string;
      gender?: string;
    };
    res.json({
      success: true,
      data: filterAndPaginate(users, { current, pageSize, keyword, gender }),
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
    } as (typeof users)[number];
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
