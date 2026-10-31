import { OPEN_COMMAND_PALETTE_EVENT } from '@/components/CommandPalette';
import { OPEN_TOUR_EVENT } from '@/components/GuideTour';
import { REPO_URL } from '@/constants/repo';
import { DEMO_MODE } from '@/demo/mode';
import { useThemeMode } from '@/hooks/useThemeMode';
import { logout } from '@/services/auth';
import { getDemoClock, resetDemoData, switchDemoScenario } from '@/services/system';
import { avatarColor, avatarText } from '@/utils/avatar';
import { formatDateTime } from '@/utils/format';
import { isMac } from '@/utils/platform';
import {
  DownOutlined,
  FieldTimeOutlined,
  GithubOutlined,
  LogoutOutlined,
  MoonOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SunOutlined,
  TranslationOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { getLocale, history, setLocale, useAccess, useIntl, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { App, Avatar, Button, Dropdown, Tag, Tooltip } from 'antd';
import { useEffect, useState } from 'react';

const localeOptions = [
  // 语言名按惯例用该语言自身书写，不随界面语言翻译
  // eslint-disable-next-line local/no-cjk-literal
  { label: '简体中文', value: 'zh-CN' },
  // 'English' 不含 CJK 字符，本行不需要禁用指令（原指令是空操作，reportUnusedDisableDirectives 已开）
  { label: 'English', value: 'en-US' },
];

/**
 * 顶栏右侧：主题切换、语言、GitHub、账户菜单（演示场景 / 重置演示数据 / 退出登录）。
 * 菜单均为 antd Dropdown（仅 click 展开，键盘可聚焦、回车打开、方向键选择——hover 展开菜单
 * 容易在扫过顶栏时误弹，不符合「点击才出菜单」的惯例）。
 * 受控演示模式下额外展示「演示时间」标记——冻结时钟必须显式可见，不假装数据正按现实时间刷新。
 */
const RightContent = () => {
  const intl = useIntl();
  const { message, modal } = App.useApp();
  const { initialState, setInitialState } = useModel('@@initialState');
  const { dark, toggle: toggleTheme } = useThemeMode();
  const access = useAccess();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const [clock, setClock] = useState<{ mode: 'live' | 'frozen'; demoTime: string }>();
  const canManageDemo = DEMO_MODE && access.permission('system.demo.reset');

  const signedIn = !!initialState?.name;
  useEffect(() => {
    // 未登录不拉时钟（登录页顶栏无需受控标记；也避免任何未授权请求触发请求层跳转）
    if (!DEMO_MODE || !signedIn) return;
    let cancelled = false;
    // 受控演示标记：挂载与每次窗口聚焦时刷新（场景操作后时间不再前进，值稳定）
    const refresh = () => {
      void getDemoClock()
        .then((state) => {
          if (!cancelled) setClock({ mode: state.mode, demoTime: state.demoTime });
        })
        .catch(() => undefined);
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
    };
  }, [signedIn]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      message.error(t('header.logoutFailed'));
      return;
    }
    await setInitialState(undefined);
    message.success(t('header.loggedOut'));
    history.push('/login');
  };

  const handleResetDemo = () => {
    if (!DEMO_MODE) return;
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

  /** 进入/退出固定演示场景（D04）：进入 = 冻结演示时钟 + 场景初始数据；退出 = 回实时自然数据 */
  const handleScenario = (action: 'enter' | 'exit') => {
    modal.confirm({
      title: t(`header.scenario.${action}`),
      content: t(`header.scenario.${action}Desc`),
      onOk: async () => {
        const state = await switchDemoScenario(action);
        message.success(t(`header.scenario.${action}Done`, { time: formatDateTime(state.demoTime, 'HH:mm') }));
        window.location.reload();
      },
    });
  };

  const accountMenu: MenuProps = {
    items: [
      // 固定演示场景与数据重定只在演示模式且有 system.demo.reset 权限时出现（按权限矩阵：仅管理员）
      ...(canManageDemo
        ? [
            clock?.mode === 'frozen'
              ? { key: 'scenarioExit', icon: <PlayCircleOutlined />, label: t('header.scenario.exit') }
              : { key: 'scenarioEnter', icon: <FieldTimeOutlined />, label: t('header.scenario.enter') },
            { key: 'reset', icon: <UndoOutlined />, label: t('header.resetDemo') },
          ]
        : []),
      // 导览是帮助入口；指南针留给「地图」菜单，避免同一图标两种含义
      { key: 'tour', icon: <QuestionCircleOutlined />, label: t('tour.menu') },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: t('header.logout') },
    ],
    onClick: ({ key }) => {
      if (key === 'reset') handleResetDemo();
      else if (key === 'scenarioEnter') handleScenario('enter');
      else if (key === 'scenarioExit') handleScenario('exit');
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
  const identity = avatarColor(displayName);
  const themeLabel = intl.formatMessage(
    { id: 'header.switchTheme' },
    { mode: t(dark ? 'header.themeLight' : 'header.themeDark') },
  );
  // ⌘K / Ctrl+K 随平台显示（与命令面板内部判定同一口径）
  const searchLabel = `${t('header.search')} (${isMac() ? '⌘K' : 'Ctrl+K'})`;

  return (
    // backgroundColor 内联写死：ProLayout 会给 actions 容器的这个直接子元素刷一层淡底（hover 时
    // rgba(0,0,0,.03)/深色对应值），与本区域内按钮自身的 hover 药丸叠成「整体 + 账号」两层背景；
    // 其 CSS-in-JS 注入难枚举，内联声明对任何选择器都成立，压掉容器层、只留每个按钮自己的反馈
    <div className="admin-header-actions flex items-center gap-2 pr-2" style={{ backgroundColor: 'transparent' }}>
      {clock?.mode === 'frozen' && (
        <Tooltip title={t('header.demoClockTip', { time: formatDateTime(clock.demoTime, 'YYYY-MM-DD HH:mm') })}>
          <Tag color="gold" icon={<FieldTimeOutlined />} className="m-0 hidden sm:inline-flex">
            {t('header.demoClock', { time: formatDateTime(clock.demoTime, 'MM-DD HH:mm') })}
          </Tag>
        </Tooltip>
      )}
      <Tooltip title={searchLabel}>
        <Button
          aria-label={searchLabel}
          type="text"
          icon={<SearchOutlined />}
          onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
        />
      </Tooltip>
      <Tooltip title={themeLabel}>
        <Button
          data-tour="theme"
          aria-label={themeLabel}
          type="text"
          icon={dark ? <SunOutlined /> : <MoonOutlined />}
          onClick={toggleTheme}
        />
      </Tooltip>
      <Dropdown menu={localeMenu} placement="bottomRight" trigger={['click']}>
        <Button aria-label={t('header.language')} type="text" icon={<TranslationOutlined />} />
      </Dropdown>
      <Tooltip title={t('header.github')}>
        <Button
          aria-label={t('header.github')}
          type="text"
          icon={<GithubOutlined />}
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
        />
      </Tooltip>
      <Dropdown menu={accountMenu} placement="bottomRight" trigger={['click']}>
        {/* 描边头像（透明底 + 身份色圈 + 同色字）：比实心色块更轻，不与任何底色叠层；
            账户入口内联压掉所有状态的底色，hover 反馈由名字提亮 + 箭头示意承担。
            字母居中的加固见 tailwind.css 的 .ant-avatar-string 规则 */}
        <Button
          data-tour="account"
          aria-label={t('header.account')}
          type="text"
          className="flex items-center"
          style={{ backgroundColor: 'transparent' }}
        >
          <Avatar
            size={26}
            style={{ backgroundColor: 'transparent', color: identity, border: `1px solid ${identity}` }}
          >
            {avatarText(displayName)}
          </Avatar>
          <span className="ml-2 hidden text-[13px] font-normal sm:inline">{displayName}</span>
          <DownOutlined className="ml-1.5 text-[10px]! opacity-45" />
        </Button>
      </Dropdown>
    </div>
  );
};

export default RightContent;
