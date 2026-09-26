import { AUTH_TOKEN_KEY } from '@/constants';
import { login } from '@/services/auth';
import { readTheme } from '@/utils/Auth/initialState';
import { UserInfo } from '@/utils/Auth/userInfo';
import { history, useIntl, useLocation, useModel } from '@umijs/max';
import { App, Button, Card, Form, Input } from 'antd';
import { useEffect } from 'react';

/** 登录后回到原本要访问的页面；只接受站内路径，防止开放重定向 */
const safeRedirect = (search: string) => {
  const target = new URLSearchParams(search).get('redirect');
  return target && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/login') ? target : '/';
};

const Login: React.FC = () => {
  // App 上下文中的 message：跳转离开登录页后提示仍然可见
  const { message: messageApi } = App.useApp();
  const intl = useIntl();
  const location = useLocation();
  const { initialState, setInitialState } = useModel('@@initialState');

  // 登录态真正写入全局状态之后再跳转。此前在 setInitialState 之后立即 push：状态尚未提交时
  // 路由守卫看到的仍是未登录，又被重定向回登录页（登录请求变为异步后稳定复现）
  const signedIn = !!initialState?.name;
  useEffect(() => {
    if (signedIn && localStorage.getItem(AUTH_TOKEN_KEY)) {
      history.replace(safeRedirect(location.search));
    }
  }, [signedIn, location.search]);

  const handleFinish = async (values: { name: string; password: string }) => {
    try {
      const { token, user } = await login(values);
      try {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      } catch {
        // 隐私模式 / 配额满等本地存储不可用：点击无任何反馈比失败提示更糟（审计 2026-09-22 L-8）
        messageApi.error(intl.formatMessage({ id: 'login.storageError' }));
        return;
      }
      // 立即刷新全局初始状态（保留当前主题），让路由守卫与 access 权限即时生效
      await setInitialState({ ...new UserInfo(user), theme: readTheme() });
      messageApi.success(intl.formatMessage({ id: 'login.success' }));
    } catch {
      // 登录失败提示由全局 errorHandler 统一呈现（BizError / HTTP 错误均在其分流内）
    }
  };

  return (
    // 背景与提示色用 antd token 类（登录页在 umi 包裹的 antd <App> 容器内，变量可用），暗色模式随算法切换
    <div className="flex min-h-screen items-center justify-center bg-bg-layout px-4">
      <Card className="w-full max-w-sm" title="React Admin">
        <p className="mb-4 text-center text-xs text-text-tertiary">{intl.formatMessage({ id: 'login.demoHint' })}</p>
        <Form initialValues={{ name: 'admin' }} layout="vertical" onFinish={handleFinish}>
          <Form.Item
            label={intl.formatMessage({ id: 'login.username' })}
            name="name"
            rules={[{ required: true, message: intl.formatMessage({ id: 'login.usernameRequired' }) }]}
          >
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item
            label={intl.formatMessage({ id: 'login.password' })}
            name="password"
            rules={[{ required: true, message: intl.formatMessage({ id: 'login.passwordRequired' }) }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Button block htmlType="submit" type="primary">
              {intl.formatMessage({ id: 'login.submit' })}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
