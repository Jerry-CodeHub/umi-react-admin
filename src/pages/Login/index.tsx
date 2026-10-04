import { AUTH_TOKEN_KEY } from '@/constants';
import { useThemeMode } from '@/hooks/useThemeMode';
import { login, type LoginParams } from '@/services/auth';
import { readTheme } from '@/utils/Auth/initialState';
import { UserInfo } from '@/utils/Auth/userInfo';
import {
  CheckCircleFilled,
  EyeOutlined,
  GlobalOutlined,
  MoonOutlined,
  SafetyCertificateOutlined,
  SunOutlined,
} from '@ant-design/icons';
import { getLocale, history, setLocale, useIntl, useLocation, useModel } from '@umijs/max';
import { App, Button, Card, Divider, Dropdown, Form, Input, Typography } from 'antd';
import { useEffect, useState } from 'react';

/** 登录后回到原本要访问的页面；只接受站内路径，防止开放重定向 */
const safeRedirect = (search: string) => {
  const target = new URLSearchParams(search).get('redirect');
  return target && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/login') ? target : '/';
};

const HIGHLIGHTS = ['dashboard', 'system', 'maps', 'i18n'];

const Login: React.FC = () => {
  // App 上下文中的 message：跳转离开登录页后提示仍然可见
  const { message: messageApi } = App.useApp();
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const location = useLocation();
  const { initialState, setInitialState } = useModel('@@initialState');
  const { dark, toggle } = useThemeMode();
  const [pending, setPending] = useState<string>();

  // 登录态真正写入全局状态之后再跳转。此前在 setInitialState 之后立即 push：状态尚未提交时
  // 路由守卫看到的仍是未登录，又被重定向回登录页（登录请求变为异步后稳定复现）
  const signedIn = !!initialState?.name;
  useEffect(() => {
    if (signedIn && localStorage.getItem(AUTH_TOKEN_KEY)) {
      history.replace(safeRedirect(location.search));
    }
  }, [signedIn, location.search]);

  const signIn = async (values: LoginParams) => {
    setPending(values.name);
    try {
      const { token, user } = await login(values);
      try {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      } catch {
        // 隐私模式 / 配额满等本地存储不可用：点击无任何反馈比失败提示更糟（审计 2026-09-22 L-8）
        messageApi.error(t('login.storageError'));
        return;
      }
      // 立即刷新全局初始状态（保留当前主题），让路由守卫与 access 权限即时生效
      await setInitialState({ ...new UserInfo(user), theme: readTheme() });
      messageApi.success(t('login.success'));
    } catch {
      // 登录失败提示由全局 errorHandler 统一呈现（BizError / HTTP 错误均在其分流内）
    } finally {
      setPending(undefined);
    }
  };

  return (
    // 背景与文字色用 antd token 类（登录页在 umi 包裹的 antd <App> 容器内），暗色模式随算法切换
    <div className="flex min-h-screen bg-bg-layout">
      <aside
        className="hidden w-5/12 max-w-[640px] flex-col justify-between p-12 text-white lg:flex"
        style={{ background: 'linear-gradient(150deg, #0b1a33 0%, #12345c 55%, #1d4f8f 100%)' }}
      >
        <div className="flex items-center gap-3 text-lg font-semibold">
          <img src={`${PUBLIC_PATH}logo.svg`} alt="" className="h-8 w-8" />
          React Admin
        </div>
        <div>
          <h1 className="m-0 text-3xl leading-snug font-semibold">{t('login.headline')}</h1>
          <p className="mt-4 text-base leading-relaxed opacity-80">{t('login.subhead')}</p>
          <ul className="mt-8 list-none space-y-3 p-0">
            {HIGHLIGHTS.map((key) => (
              <li key={key} className="flex items-start gap-3 opacity-90">
                <CheckCircleFilled className="mt-1" style={{ color: '#69b1ff' }} />
                {t(`login.highlight.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs opacity-60">Umi Max · React 19 · Ant Design 5 · AntV · Cesium · OpenLayers</div>
      </aside>

      <main className="relative flex flex-1 items-center justify-center px-4 py-16">
        <div className="absolute top-4 right-4 flex gap-1">
          <Button
            type="text"
            aria-label={t('header.theme')}
            icon={dark ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggle}
          />
          <Dropdown
            menu={{
              items: [
                // 语言名按惯例用该语言自身书写
                // eslint-disable-next-line local/no-cjk-literal
                { key: 'zh-CN', label: '简体中文' },
                { key: 'en-US', label: 'English' },
              ],
              selectable: true,
              selectedKeys: [getLocale()],
              onClick: ({ key }) => setLocale(key),
            }}
          >
            <Button type="text" aria-label={t('header.language')} icon={<GlobalOutlined />} />
          </Dropdown>
        </div>

        <Card className="w-full max-w-sm shadow-sm" title={t('login.title')}>
          <div className="flex flex-col gap-3">
            <Button
              size="large"
              type="primary"
              block
              icon={<SafetyCertificateOutlined />}
              loading={pending === 'admin'}
              onClick={() => signIn({ name: 'admin', password: 'demo' })}
            >
              {t('login.asAdmin')}
            </Button>
            <Typography.Text type="secondary" className="-mt-2 text-center text-xs">
              {t('login.asAdminDesc')}
            </Typography.Text>
            <Button
              size="large"
              block
              icon={<EyeOutlined />}
              loading={pending === 'guest'}
              onClick={() => signIn({ name: 'guest', password: 'demo' })}
            >
              {t('login.asGuest')}
            </Button>
            <Typography.Text type="secondary" className="-mt-2 text-center text-xs">
              {t('login.asGuestDesc')}
            </Typography.Text>
          </div>
          <Divider plain className="text-xs!">
            {t('login.or')}
          </Divider>
          <Form<LoginParams> initialValues={{ name: 'admin', password: 'demo' }} layout="vertical" onFinish={signIn}>
            <Form.Item
              label={t('login.username')}
              name="name"
              rules={[{ required: true, message: t('login.usernameRequired') }]}
            >
              <Input autoComplete="username" />
            </Form.Item>
            <Form.Item
              label={t('login.password')}
              name="password"
              rules={[{ required: true, message: t('login.passwordRequired') }]}
            >
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Button block htmlType="submit" loading={!!pending && pending !== 'admin' && pending !== 'guest'}>
              {t('login.submit')}
            </Button>
          </Form>
          <Typography.Paragraph type="secondary" className="mt-4 mb-0 text-center text-xs">
            {t('login.demoHint')}
          </Typography.Paragraph>
        </Card>
      </main>
    </div>
  );
};

export default Login;
