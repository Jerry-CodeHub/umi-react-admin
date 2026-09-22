import { AUTH_TOKEN_KEY } from '@/constants';
import { logout } from '@/services/auth';
import { THEME_STORAGE_KEY, type AppInitialState, type ThemeMode } from '@/utils/Auth/initialState';
import { GithubOutlined, GlobalOutlined, SkinOutlined, UserOutlined } from '@ant-design/icons';
import { history, setLocale, useAntdConfigSetter, useIntl, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Avatar, Button, Divider, Dropdown, Tooltip, theme as antdTheme, message } from 'antd';
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

const localeOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
];

/**
 * 顶栏右侧：账户 / 主题 / 语言 / GitHub。
 * 三个菜单用 antd Dropdown（hover 与 click 均可展开，Tab 聚焦后回车打开、方向键选择），
 * 此前是 hover 触发的 Popover + div onClick，键盘无法操作。
 */
const RightContent = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const intl = useIntl();
  const { initialState, setInitialState } = useModel('@@initialState');
  const setAntdConfig = useAntdConfigSetter();
  const [localeType, setLocaleType] = useState(safeLocalStorage.getItem('umi_locale') || 'zh-CN');

  useEffect(() => {
    if (!safeLocalStorage.getItem('umi_locale')) {
      setLocale('zh-CN');
    }
  }, []);

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

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // best-effort：退出接口失败不阻断本地登出
    }
    safeLocalStorage.removeItem(AUTH_TOKEN_KEY);
    await setInitialState(undefined);
    messageApi.success(intl.formatMessage({ id: 'Logout' }));
    history.push('/login');
  };

  const accountMenu: MenuProps = {
    items: [{ key: 'logout', label: intl.formatMessage({ id: 'Logout' }) }],
    onClick: handleLogout,
  };

  const themeMenu: MenuProps = {
    items: [
      { key: 'light', label: intl.formatMessage({ id: 'undertone' }) },
      { key: 'realDark', label: intl.formatMessage({ id: 'DarkColor' }) },
    ],
    selectable: true,
    selectedKeys: [initialState?.theme ?? 'light'],
    onClick: ({ key }) => applyTheme(key as ThemeMode),
  };

  const localeMenu: MenuProps = {
    items: localeOptions.map(({ label, value }) => ({ key: value, label })),
    selectable: true,
    selectedKeys: [localeType],
    onClick: ({ key }) => {
      setLocale(key);
      setLocaleType(key);
    },
  };

  const themeLabel = intl.formatMessage({ id: 'header.theme' });
  const languageLabel = intl.formatMessage({ id: 'header.language' });
  const githubLabel = intl.formatMessage({ id: 'header.github' });
  const trigger: ('hover' | 'click')[] = ['hover', 'click'];

  return (
    <>
      {contextHolder}
      <Dropdown menu={accountMenu} placement="bottom" trigger={trigger}>
        <Button className="flex items-center" type="text">
          <Avatar className="flex items-center justify-center" icon={<UserOutlined />} size={28} />
          <span className="ml-2">{initialState?.nickName ?? 'Admin'}</span>
        </Button>
      </Dropdown>

      <Divider className="mx-5 h-7" type="vertical" />

      <Dropdown menu={themeMenu} placement="bottom" trigger={trigger}>
        <Button aria-label={themeLabel} className="mr-5 flex items-center justify-center" icon={<SkinOutlined />} />
      </Dropdown>

      <Dropdown menu={localeMenu} placement="bottom" trigger={trigger}>
        <Button
          aria-label={languageLabel}
          className="mr-5 flex items-center justify-center"
          icon={<GlobalOutlined />}
        />
      </Dropdown>

      <Tooltip title={githubLabel}>
        <Button
          aria-label={githubLabel}
          className="mr-6"
          icon={<GithubOutlined />}
          onClick={() => {
            window.open('https://github.com/Jerry-CodeHub/umi-react-admin', '_blank', 'noopener,noreferrer');
          }}
        />
      </Tooltip>
    </>
  );
};

export default RightContent;
