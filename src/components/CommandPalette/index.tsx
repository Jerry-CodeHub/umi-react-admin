import { isMac } from '@/utils/platform';
import { canAccessRoute, type NavRoute } from '@/utils/routeNav';
import { SearchOutlined } from '@ant-design/icons';
import { history, useAccess, useAppData, useIntl } from '@umijs/max';
import { Input, Modal, theme } from 'antd';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

/** 头像区搜索按钮派发这个事件打开面板（与 GuideTour 的 OPEN_TOUR_EVENT 同一模式） */
export const OPEN_COMMAND_PALETTE_EVENT = 'umi-react-admin:open-command-palette';

export type NavEntry = { path: string; keyChain: string[]; access?: string };

/** 展平命名路由树为可搜索条目：只取叶子页（有名字、无命名子路由，含 dashboard 这类无分组单页）。
 *  与菜单同口径排除 hideInMenu（登录页、`*` 兜底 404）及带通配/参数的路径（push 过去没有意义） */
export const flattenNavEntries = (routes: NavRoute[]): NavEntry[] => {
  const walk = (list: NavRoute[], names: string[]): NavEntry[] =>
    list.flatMap((route) => {
      const children = route.routes ?? [];
      if (route.hideInMenu || /[*:]/.test(route.path ?? '')) return [];
      // 无名路由（umi 的布局包裹层）自身不进面板，但它的子树要继续走
      if (!route.name || !route.path) return walk(children, names);
      const next = [...names, route.name];
      // 文案键与菜单/页面标题同一套规则：menu.<父级>.<名>（见 src/utils/pageTitle.ts）
      const keyChain = next.map((_, index) => `menu.${next.slice(0, index + 1).join('.')}`);
      return children.some((child) => child.name)
        ? walk(children, next)
        : [{ path: route.path, keyChain, access: route.access }];
    });
  return walk(routes, []);
};

/** 过滤：按当前语言文案与路径做小写包含匹配；空查询返回全部 */
export const filterEntries = (entries: NavEntry[], query: string, labelOf: (entry: NavEntry) => string) => {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((entry) => labelOf(entry).toLowerCase().includes(q) || entry.path.toLowerCase().includes(q));
};

/**
 * ⌘K / Ctrl+K 命令面板：全站页面按名直达，弥补宽信息架构下「目标页在哪个分组」的记忆成本，
 * 也是窄屏页签横滚之外的补救路径。键盘优先（↑↓ 选、Enter 开、Esc 关），权限过滤与菜单同口径。
 */
export default function CommandPalette() {
  const { clientRoutes } = useAppData();
  const access = useAccess() as Record<string, unknown>;
  const intl = useIntl();
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // combobox 语义：焦点始终留在输入框，活动项经 aria-activedescendant 告诉读屏器（listbox 本身不获焦）
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const entries = useMemo(
    () =>
      // 与菜单、GroupNav 同口径（canAccessRoute）：access 键为 false 或缺失的页面不进面板
      flattenNavEntries(clientRoutes as unknown as NavRoute[]).filter((entry) => canAccessRoute(access, entry)),
    [clientRoutes, access],
  );

  const labelOf = (entry: NavEntry) => entry.keyChain.map((key) => intl.formatMessage({ id: key })).join(' / ');
  const visible = useMemo(
    () =>
      filterEntries(entries, query, (entry) =>
        entry.keyChain.map((key) => intl.formatMessage({ id: key })).join(' / '),
      ).slice(0, 15),
    [entries, query, intl],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  // 键盘活动项滚回视野
  useEffect(() => {
    listRef.current?.querySelectorAll('[role="option"]')[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (path: string) => {
    setOpen(false);
    setQuery('');
    history.push(path);
    window.scrollTo(0, 0);
  };

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      closable={false}
      width={520}
      centered
      styles={{ body: { padding: 0, overflow: 'hidden' } }}
    >
      <Input
        autoFocus
        allowClear
        variant="borderless"
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder={intl.formatMessage({ id: 'palette.placeholder' })}
        aria-label={intl.formatMessage({ id: 'palette.placeholder' })}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible.length > 0}
        aria-controls={listId}
        aria-activedescendant={visible[active] ? optionId(active) : undefined}
        value={query}
        onChange={({ target }) => setQuery(target.value)}
        onKeyDown={(event) => {
          const { key, nativeEvent } = event;
          // 输入法组字中（拼音选词/上屏的 Enter、方向键翻候选）交给输入法；Safari 组字结束的那次
          // keydown 已不带 isComposing，只能靠 keyCode 229 识别
          if (nativeEvent.isComposing || nativeEvent.keyCode === 229) return;
          if (key === 'ArrowDown') {
            event.preventDefault(); // 不让光标跳到行尾
            setActive((value) => Math.min(value + 1, visible.length - 1));
          } else if (key === 'ArrowUp') {
            event.preventDefault();
            setActive((value) => Math.max(value - 1, 0));
          } else if (key === 'Enter' && visible[active]) {
            choose(visible[active].path);
          }
        }}
        style={{ paddingBlock: 12, paddingInline: 16, fontSize: 15 }}
      />
      <div ref={listRef} id={listId} role="listbox" aria-label={intl.formatMessage({ id: 'palette.placeholder' })}>
        {visible.map((entry, index) => (
          <div
            key={entry.path}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            onMouseEnter={() => setActive(index)}
            onClick={() => choose(entry.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingInline: 16,
              paddingBlock: 8,
              cursor: 'pointer',
              backgroundColor: index === active ? token.colorFillSecondary : undefined,
            }}
          >
            <span style={{ fontSize: 14 }}>{labelOf(entry)}</span>
            <span style={{ fontSize: 12, color: token.colorTextTertiary }}>{entry.path}</span>
          </div>
        ))}
      </div>
      {/* 空态放在 listbox 之外（listbox 只能含 option），以 status 播报给读屏器 */}
      {visible.length === 0 && (
        <div role="status" style={{ padding: 24, textAlign: 'center', color: token.colorTextTertiary, fontSize: 13 }}>
          {intl.formatMessage({ id: 'palette.empty' })}
        </div>
      )}
      <div
        style={{
          paddingInline: 16,
          paddingBlock: 8,
          borderTop: `1px solid ${token.colorSplit}`,
          color: token.colorTextTertiary,
          fontSize: 12,
        }}
      >
        {intl.formatMessage({ id: 'palette.hint' }, { mod: isMac() ? '⌘K' : 'Ctrl+K' })}
      </div>
    </Modal>
  );
}
