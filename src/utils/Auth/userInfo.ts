// use to init UserInfo
export type UserClaim = {
  name: string;
  email: string;
  nickName?: string;
  /** 角色声明（演示签发方或真实后端返回）；access 权限消费它 */
  role?: string;
};

export class UserInfo {
  public name: string;
  public email: string;
  public nickName: string;
  /** undefined 视为无管理权限（见 src/access.ts：白名单式判定，不回退到「登录即 admin」） */
  public role: string | undefined;

  constructor(userClaim: UserClaim) {
    this.name = userClaim.name || '';
    this.email = userClaim.email || '';
    this.nickName = userClaim.nickName || userClaim.name || '';
    this.role = userClaim.role;
  }
}
