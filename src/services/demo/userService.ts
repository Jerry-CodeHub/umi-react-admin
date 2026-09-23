import { BizError } from '@/utils/BizError';
import * as UserController from './UserController';
import { USE_BACKEND } from './mode';
import { filterAndPaginate, type UserQuery } from './userQuery';

/**
 * 用户数据服务适配层（审计 extra-1-2：演示站 /table 生产降级）。
 * 三层分发：
 * 1. dev 开发环境 → 委托 UserController 走 umi mock；
 * 2. 配置了 UMI_APP_API_BASE → 委托并经 requestConfig 的 baseURL 发往真实后端；
 * 3. 其余生产构建（GitHub Pages / Vercel 纯静态托管）→ 拉取 public/data/users.json
 *    静态种子，CRUD 持久化在 localStorage，让演示站的表格页真实可交互。
 * 模式判定见 ./mode.ts（与鉴权共用）。
 */

const DEMO_USERS_KEY = 'umi-react-admin-demo-users';

type DemoUser = {
  id: string;
  name: string;
  nickName: string;
  gender: 'MALE' | 'FEMALE';
  email: string;
};

let cache: DemoUser[] | null = null;

const persist = () => {
  if (typeof window !== 'undefined' && cache) {
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(cache));
  }
};

/** localStorage 中的演示数据被污染（手改/损坏）时返回 null，由调用方回落静态种子（审计 L-5） */
const parseStoredUsers = (stored: string): DemoUser[] | null => {
  try {
    const list = JSON.parse(stored) as unknown;
    if (!Array.isArray(list)) {
      return null;
    }
    const shapeOk = list.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as DemoUser).id === 'string' &&
        typeof (item as DemoUser).name === 'string',
    );
    return shapeOk ? (list as DemoUser[]) : null;
  } catch {
    return null;
  }
};

const loadUsers = async (): Promise<DemoUser[]> => {
  if (cache) {
    return cache;
  }
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(DEMO_USERS_KEY);
    if (stored) {
      const parsed = parseStoredUsers(stored);
      if (parsed) {
        cache = parsed;
        return cache;
      }
      localStorage.removeItem(DEMO_USERS_KEY);
    }
  }
  const resp = await fetch(`${PUBLIC_PATH}data/users.json`);
  if (!resp.ok) {
    throw new BizError({ message: '演示数据加载失败', errorCode: 500 });
  }
  cache = (await resp.json()) as DemoUser[];
  persist();
  return cache;
};

const findUser = async (userId: string) => {
  const list = await loadUsers();
  const user = list.find((item) => item.id === userId);
  if (!user) {
    throw new BizError({ message: '用户不存在', errorCode: 404 });
  }
  return user;
};

const staticImpl = {
  async queryUserList(params: UserQuery) {
    // 与 mock 接口共用同一份查询逻辑（keyword / name / nickName / gender + 分页）
    return { success: true, data: filterAndPaginate(await loadUsers(), params), errorCode: 0 };
  },
  async addUser(body?: Partial<DemoUser>) {
    const list = await loadUsers();
    const user: DemoUser = {
      id: `${Date.now()}`,
      name: body?.name ?? '',
      nickName: body?.nickName ?? '',
      gender: body?.gender ?? 'MALE',
      email: body?.email ?? '',
    };
    cache = [user, ...list];
    persist();
    return { success: true, data: user, errorCode: 0 };
  },
  async modifyUser(params: { userId?: string }, body?: Partial<DemoUser>) {
    const user = await findUser(params.userId ?? '');
    Object.assign(user, { ...body, id: user.id });
    persist();
    return { success: true, data: user, errorCode: 0 };
  },
  async deleteUser(params: { userId?: string }) {
    const list = await loadUsers();
    cache = list.filter((user) => user.id !== params.userId);
    persist();
    return { success: true, data: params.userId ?? '', errorCode: 0 };
  },
  async getUserDetail(params: { userId?: string }) {
    const user = await findUser(params.userId ?? '');
    return { success: true, data: user, errorCode: 0 };
  },
};

export const userService = USE_BACKEND ? UserController : staticImpl;
