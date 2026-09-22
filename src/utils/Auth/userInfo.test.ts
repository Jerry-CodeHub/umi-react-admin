import { describe, expect, it } from 'vitest';
import { UserInfo } from './userInfo';

describe('UserInfo', () => {
  it('完整字段构造', () => {
    const user = new UserInfo({ name: 'jerry', email: 'jerry@example.com', nickName: 'Jerry' });
    expect(user.name).toBe('jerry');
    expect(user.email).toBe('jerry@example.com');
    expect(user.nickName).toBe('Jerry');
  });

  it('nickName 缺省回退 name', () => {
    const user = new UserInfo({ name: 'umi', email: 'umi@example.com' });
    expect(user.nickName).toBe('umi');
  });

  it('空串字段兜底为空串', () => {
    const user = new UserInfo({ name: '', email: '' });
    expect(user.name).toBe('');
    expect(user.email).toBe('');
    expect(user.nickName).toBe('');
  });
});
