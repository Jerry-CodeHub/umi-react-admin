/**
 * 演示用户的查询逻辑（纯函数，无浏览器/umi 运行时依赖）。
 * mock/userAPI.ts（dev 接口）与 userService 的静态实现（纯静态托管）共用，保证两条链路的查询语义一致。
 */

export type DemoUserRecord = {
  id: string;
  name: string;
  nickName: string;
  gender: string;
  email: string;
};

export type UserQuery = {
  current?: number | string;
  pageSize?: number | string;
  /** 工具栏关键字：同时匹配名称与昵称 */
  keyword?: string;
  /** 以下三项对应 ProTable 查询表单的列（dataIndex） */
  name?: string;
  nickName?: string;
  gender?: string;
};

/** 过滤（keyword / name / nickName / gender）+ 分页（current / pageSize，含缺省） */
export function filterAndPaginate<T extends DemoUserRecord>(users: T[], query: UserQuery) {
  const { current = 1, pageSize = 20, keyword, name, nickName, gender } = query;
  const list = users.filter(
    (user) =>
      (!keyword || user.name.includes(keyword) || user.nickName.includes(keyword)) &&
      (!name || user.name.includes(name)) &&
      (!nickName || user.nickName.includes(nickName)) &&
      (!gender || user.gender === gender),
  );
  const start = (Number(current) - 1) * Number(pageSize);
  return {
    current: Number(current),
    pageSize: Number(pageSize),
    total: list.length,
    list: list.slice(start, start + Number(pageSize)),
  };
}
