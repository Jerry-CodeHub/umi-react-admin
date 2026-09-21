// 参考文档 https://umijs.org/docs/max/access
export default (initialState: API.UserInfo) => {
  // 'dontHaveAccess' 是演示后端（mock）约定的禁止访问用户名：
  // 该用户可登录（currentUser 正常返回），但 canSeeAdmin 为 false，
  // 用于演示 /access、/table 的路由权限拦截（会跳转 /403）
  const canSeeAdmin = !!initialState?.name && initialState.name !== 'dontHaveAccess';
  return {
    canSeeAdmin,
  };
};
