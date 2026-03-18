// 参考文档 https://umijs.org/docs/max/access
export default (initialState: API.UserInfo) => {
  // 'dontHaveAccess' 是约定的禁止访问标识符，由后端登录接口返回以拒绝特定用户进入管理后台
  const canSeeAdmin = !!(initialState && initialState.name !== 'dontHaveAccess');
  return {
    canSeeAdmin,
  };
};
