// use to init UserInfo
export type UserClaim = {
  name: string;
  email: string;
  nickName?: string;
};

export class UserInfo {
  public name: string;
  public email: string;
  public nickName: string;

  constructor(userClaim: UserClaim) {
    this.name = userClaim.name || '';
    this.email = userClaim.email || '';
    this.nickName = userClaim.nickName || userClaim.name || '';
  }
}
