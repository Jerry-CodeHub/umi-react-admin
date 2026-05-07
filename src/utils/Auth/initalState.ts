import { UserInfo } from './userInfo';

export async function getInitialState(): Promise<UserInfo> {
  const user: UserInfo = new UserInfo({
    name: 'admin',
    email: '',
    nickName: 'Admin',
  });

  return user;
}
