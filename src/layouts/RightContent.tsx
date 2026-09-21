import { AUTH_TOKEN_KEY } from '@/constants';
import { logout } from '@/services/auth';
import { THEME_STORAGE_KEY, type AppInitialState, type ThemeMode } from '@/utils/Auth/initialState';
import { GithubOutlined, GlobalOutlined, SkinOutlined, UserOutlined } from '@ant-design/icons';
import { history, setLocale, useAntdConfigSetter, useIntl, useModel } from '@umijs/max';
import { Avatar, Button, Divider, Popover, Tooltip, theme as antdTheme, message } from 'antd';
import { useEffect, useState } from 'react';

const safeLocalStorage = {
  getItem: (key: string) => (typeof window !== 'undefined' ? localStorage.getItem(key) : null),
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  },
};

const RightContent = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const intl = useIntl();
  const { initialState, setInitialState } = useModel('@@initialState');
  const setAntdConfig = useAntdConfigSetter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [localeType, setLocaleType] = useState(safeLocalStorage.getItem('umi_locale') || 'zh-CN');

  useEffect(() => {
    if (!safeLocalStorage.getItem('umi_locale')) {
      setLocale('zh-CN');
    }
  }, []);

  const localeTypeData = [
    {
      label: '中文',
      value: 'zh-CN',
    },
    {
      label: 'English',
      value: 'en-US',
    },
  ];

  /** 切换主题：antd 算法经 useAntdConfigSetter 热切换，ProLayout navTheme 与持久化经 initialState 同步 */
  const applyTheme = (mode: ThemeMode) => {
    safeLocalStorage.setItem(THEME_STORAGE_KEY, mode);
    setAntdConfig({
      theme: { algorithm: mode === 'realDark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm },
    });
    setInitialState((prev: AppInitialState | undefined) => ({
      name: '',
      email: '',
      nickName: '',
      ...prev,
      theme: mode,
    }));
  };

  const themeActions = [
    { label: intl.formatMessage({ id: 'undertone' }), mode: 'light' as ThemeMode },
    { label: intl.formatMessage({ id: 'DarkColor' }), mode: 'realDark' as ThemeMode },
  ];

  const themeLabel = intl.formatMessage({ id: 'header.theme' });
  const languageLabel = intl.formatMessage({ id: 'header.language' });
  const githubLabel = intl.formatMessage({ id: 'header.github' });

  return (
    <>
      {contextHolder}
      <Popover
        title=""
        trigger="hover"
        placement="bottom"
        className="flex items-center justify-center mr-5 "
        content={
          <div
            className="w-24 px-2 py-1 text-center rounded-md cursor-pointer hover:bg-fill-tertiary"
            onClick={async () => {
              try {
                await logout();
              } catch {
                // best-effort：退出接口失败不阻断本地登出
              }
              safeLocalStorage.removeItem(AUTH_TOKEN_KEY);
              await setInitialState(undefined);
              messageApi.success(intl.formatMessage({ id: 'Logout' }));
              history.push('/login');
            }}
          >
            {intl.formatMessage({ id: 'Logout' })}
          </div>
        }
      >
        <Avatar
          className="flex items-center justify-center"
          icon={<UserOutlined style={{ fontSize: 20 }} />}
          size={28}
        />
        <div className="ml-2">{initialState?.nickName ?? 'Admin'}</div>
      </Popover>

      <Divider className="mx-5 h-7" type="vertical" />

      <Popover
        trigger="hover"
        placement="bottom"
        className="mr-5 text-2xl"
        content={
          <div>
            {themeActions.map((item) => (
              <div
                className={`w-24 px-2 py-1 text-center rounded-md cursor-pointer hover:bg-fill-tertiary ${
                  (initialState?.theme ?? 'light') === item.mode ? 'font-semibold' : ''
                }`}
                key={item.mode}
                onClick={() => applyTheme(item.mode)}
              >
                {item.label}
              </div>
            ))}
          </div>
        }
      >
        <Tooltip title={themeLabel}>
          <Button aria-label={themeLabel} className="flex items-center justify-center" icon={<SkinOutlined />} />
        </Tooltip>
      </Popover>

      <Popover
        className="mr-5 text-2xl"
        trigger="hover"
        placement="bottom"
        content={
          <div>
            {localeTypeData.map((item) => (
              <div
                className="w-24 px-2 py-1 text-center rounded-md cursor-pointer hover:bg-fill-tertiary"
                key={item.value}
                onClick={() => {
                  setLocale(item.value);
                  setLocaleType(item.value);
                }}
              >
                {item.label}
              </div>
            ))}
          </div>
        }
      >
        <Tooltip title={languageLabel}>
          <Button aria-label={languageLabel} className="flex items-center justify-center" icon={<GlobalOutlined />} />
        </Tooltip>
      </Popover>

      <Tooltip title={githubLabel}>
        <Button
          aria-label={githubLabel}
          className="mr-6"
          icon={<GithubOutlined />}
          onClick={() => {
            window.open('https://github.com/Jerry-CodeHub/umi-react-admin');
          }}
        />
      </Tooltip>
    </>
  );
};

export default RightContent;
