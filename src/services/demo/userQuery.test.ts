import { describe, expect, it } from 'vitest';
import { filterAndPaginate, type DemoUserRecord } from './userQuery';

const users: DemoUserRecord[] = [
  { id: '0', name: 'Umi', nickName: 'U', gender: 'MALE', email: 'umi@example.com' },
  { id: '1', name: 'Fish', nickName: 'B', gender: 'FEMALE', email: 'fish@example.com' },
  { id: '2', name: 'Fisher', nickName: 'F', gender: 'MALE', email: 'fisher@example.com' },
];

describe('filterAndPaginate', () => {
  it('缺省参数：第一页 20 条', () => {
    const result = filterAndPaginate(users, {});
    expect(result.current).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.total).toBe(3);
    expect(result.list).toHaveLength(3);
  });

  it('keyword 同时匹配 name 与 nickName', () => {
    expect(filterAndPaginate(users, { keyword: 'Fish' }).list).toHaveLength(2);
    expect(filterAndPaginate(users, { keyword: 'F' }).total).toBe(2);
    expect(filterAndPaginate(users, { keyword: 'U' }).list.map((u) => u.name)).toEqual(['Umi']);
  });

  it('查询表单的 name / nickName 列生效（ProTable 按 dataIndex 传参）', () => {
    expect(filterAndPaginate(users, { name: 'Fish' }).list.map((u) => u.name)).toEqual(['Fish', 'Fisher']);
    expect(filterAndPaginate(users, { nickName: 'B' }).list.map((u) => u.name)).toEqual(['Fish']);
    expect(filterAndPaginate(users, { name: 'Umi', nickName: 'B' }).total).toBe(0);
  });

  it('gender 过滤', () => {
    const result = filterAndPaginate(users, { gender: 'FEMALE' });
    expect(result.total).toBe(1);
    expect(result.list[0].name).toBe('Fish');
  });

  it('分页切片与字符串参数兼容', () => {
    const page1 = filterAndPaginate(users, { current: '1', pageSize: '2' });
    expect(page1.list).toHaveLength(2);
    const page2 = filterAndPaginate(users, { current: 2, pageSize: 2 });
    expect(page2.list).toHaveLength(1);
    expect(page2.total).toBe(3);
  });

  it('keyword 与 gender 组合', () => {
    const result = filterAndPaginate(users, { keyword: 'Fish', gender: 'MALE' });
    expect(result.list.map((u) => u.name)).toEqual(['Fisher']);
  });
});
