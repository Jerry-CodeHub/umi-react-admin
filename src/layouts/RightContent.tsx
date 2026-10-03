import { OPEN_TOUR_EVENT } from '@/components/GuideTour';
import { AUTH_TOKEN_KEY } from '@/constants';
import { DEMO_MODE } from '@/demo/mode';
import { useThemeMode } from '@/hooks/useThemeMode';
import { logout } from '@/services/auth';
import { resetDemoData } from '@/services/system';
import { avatarColor, avatarText } from '@/utils/avatar';
import {
  CompassOutlined,
  GithubOutlined,
  GlobalOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { getLocale, history, setLocale, useIntl, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { App, Avatar, Button, Dropdown, Tooltip } from 'antd';

const safeStorage = {
  remove: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // 存储不可用：内存中的登录态同样会被清除
    }
  },
};

const localeOptions = [
  // 语言名按惯例用该语言自身书写，不随界面语言翻译
  // eslint-disable-next-line local/no-cjk-literal
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
];

/**
 * 顶栏右侧：主题切换、语言、GitHub、账户菜单（重置演示数据 / 退出登录）。
 * 菜单均为 antd Dropdown（hover 与 click 均可展开，键盘可聚焦、回车打开、方向键选择）。
 */
const RightContent = () => {
  const intl = useIntl();
  const { message, modal } = App.useApp();
  const { initialState, setInitialState } = useModel('@@initialState');
  const { dark, toggle: toggleTheme } = useThemeMode();
  const t = (id: string) => intl.formatMessage({ id });

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // best-effort：退出接口失败不阻断本地登出
    }
    safeStorage.remove(AUTH_TOKEN_KEY);
    await setInitialState(undefined);
    message.success(t('header.loggedOut'));
    history.push('/login');
  };

  const handleResetDemo = () => {
    modal.confirm({
      title: t('header.resetDemo'),
      content: t('header.resetDemoConfirm'),
      onOk: async () => {
        await resetDemoData();
        message.success(t('header.resetDemoDone'));
        // 整页刷新：所有页面重新拉取数据，避免残留的旧列表
        window.location.reload();
      },
    });
  };

  const accountMenu: MenuProps = {
    items: [
      // 重置演示数据只在演示模式出现（接了真实后端就没有这个概念）
      ...(DEMO_MODE ? [{ key: 'reset', icon: <UndoOutlined />, label: t('header.resetDemo') }] : []),
      { key: 'tour', icon: <CompassOutlined />, label: t('tour.menu') },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: t('header.logout') },
    ],
    onClick: ({ key }) => {
      if (key === 'reset') handleResetDemo();
      else if (key === 'tour') window.dispatchEvent(new Event(OPEN_TOUR_EVENT));
      else handleLogout();
    },
  };

  const localeMenu: MenuProps = {
    items: localeOptions.map(({ label, value }) => ({ key: value, label })),
    selectable: true,
    selectedKeys: [getLocale()],
    onClick: ({ key }) => setLocale(key),
  };

  const displayName = initialState?.nickName || initialState?.name || '';
  const themeLabel = intl.formatMessage(
    { id: 'header.switchTheme' },
    { mode: t(dark ? 'header.themeLight' : 'header.themeDark') },
  );

  return (
    <div className="flex items-center gap-2 pr-2">
      <Tooltip title={themeLabel}>
        <Button
          data-tour="theme"
          aria-label={themeLabel}
          type="text"
          icon={dark ? <SunOutlined /> : <MoonOutlined />}
          onClick={toggleTheme}
        />
      </Tooltip>
      <Dropdown menu={localeMenu} placement="bottomRight" trigger={['hover', 'click']}>
        <Button aria-label={t('header.language')} type="text" icon={<GlobalOutlined />} />
      </Dropdown>
      <Tooltip title={t('header.github')}>
        <Button
          aria-label={t('header.github')}
          type="text"
          icon={<GithubOutlined />}
          href="https://github.com/Jerry-CodeHub/umi-react-admin"
          target="_blank"
          rel="noopener noreferrer"
        />
      </Tooltip>
      <Dropdown menu={accountMenu} placement="bottomRight" trigger={['hover', 'click']}>
        <Button data-tour="account" aria-label={t('header.account')} type="text" className="flex items-center">
          <Avatar size={26} style={{ backgroundColor: avatarColor(displayName) }}>
            {avatarText(displayName)}
          </Avatar>
          <span className="ml-2 hidden sm:inline">{displayName}</span>
        </Button>
      </Dropdown>
    </div>
  );
};

export default RightContent;
