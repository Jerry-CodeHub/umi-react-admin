import DemoPage from '@/components/DemoPage';
import { TICKET_STATUS_KEYS } from '@/constants/enums';
import { TICKET_STATUS_COLOR } from '@/constants/semantic';
import { useApi } from '@/hooks/useApi';
import { useChartTheme } from '@/hooks/useChartTheme';
import { getTicket, listTickets, moveTicket } from '@/services/ops';
import type { Ticket, TicketPriority, TicketStatus } from '@/services/types';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { history, useIntl, useLocation } from '@umijs/max';
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Segmented,
  Select,
  Skeleton,
  Space,
  Typography,
  theme,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import TicketCard from './TicketCard';
import TicketDrawer from './TicketDrawer';

type KindFilter = 'all' | Ticket['kind'];
const PRIORITY_ORDER = { P1: 0, P2: 1, P3: 2 };

/** 待处理 / 处理中：高优先级在前、等得久的在前；已完成：最近完成的在前 */
const sortColumn = (status: TicketStatus, tickets: Ticket[]) =>
  [...tickets].sort((a, b) =>
    status === 'done'
      ? (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? '')
      : PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt.localeCompare(b.createdAt),
  );

/**
 * 键盘拖拽：左右方向键直接跳到相邻列（默认实现每次只移动 25px，跨列要按很多次）。
 */
const columnJumpCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const { collisionRect, droppableRects } = context;
  if (!collisionRect) return undefined;
  if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return undefined;
  event.preventDefault();
  const columns = [...droppableRects.values()].sort((a, b) => a.left - b.left);
  const current = columns.findIndex((rect) => collisionRect.left >= rect.left - 1 && collisionRect.left < rect.right);
  const next = columns[Math.min(columns.length - 1, Math.max(0, current + (event.code === 'ArrowRight' ? 1 : -1)))];
  return next ? { x: next.left + 12, y: next.top + 48 } : undefined;
};

/** 拖拽结束后浏览器仍会补发一次 click（dnd 的 pointer sensor 只 preventDefault mouseup）：
 *  记录最近一次 dragEnd 时刻，短窗口内忽略 click，避免拖动后放回原地的卡片弹出详情抽屉 */
const lastDragEndAt = { current: 0 };

/** 点击 / 回车打开详情；拖动（鼠标移动 6px 以上、触屏长按）才进入拖拽，二者不冲突 */
const DraggableTicket = ({ ticket, onOpen }: { ticket: Ticket; onOpen: (ticket: Ticket) => void }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ticket.id, data: { ticket } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => {
        if (Date.now() - lastDragEndAt.current < 150) return;
        onOpen(ticket);
      }}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event);
        if (event.key === 'Enter' && !event.defaultPrevented) onOpen(ticket);
      }}
      // 触屏上保留页面滚动手势；拖拽靠长按激活（TouchSensor 的 delay）
      style={{ opacity: isDragging ? 0.35 : 1, touchAction: 'manipulation' }}
    >
      <TicketCard ticket={ticket} />
    </div>
  );
};

const Column = ({
  status,
  tickets,
  onOpen,
}: {
  status: TicketStatus;
  tickets: Ticket[];
  onOpen: (ticket: Ticket) => void;
}) => {
  const intl = useIntl();
  const chart = useChartTheme();
  const { token } = theme.useToken();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className="flex min-h-[420px] flex-col rounded-lg p-3 transition-colors"
      style={{
        background: isOver ? token.controlItemBgActive : token.colorFillQuaternary,
        outline: isOver ? `2px dashed ${token.colorPrimaryBorder}` : undefined,
      }}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="flex items-center gap-2 font-medium">
          <Badge color={chart.color(TICKET_STATUS_COLOR[status])} />
          {intl.formatMessage({ id: `ticketStatus.${status}` })}
          <Typography.Text type="secondary">{tickets.length}</Typography.Text>
        </span>
        {status === 'done' && (
          <Typography.Text type="secondary" className="text-xs">
            {intl.formatMessage({ id: 'tickets.doneHint' })}
          </Typography.Text>
        )}
      </div>
      {/* 桌面三列并排时列内滚动、列高封顶在一屏内：「已完成」三天窗口常有 30+ 张卡，曾把整页拉到 4000px+，
          另两列跟着拉伸成大片空底色。手机单列堆叠时保持自然流（不制造嵌套滚动） */}
      <div
        className="-mr-1 flex flex-col gap-2 pr-1 md:max-h-[calc(100vh-200px)] md:overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        {tickets.length ? (
          tickets.map((ticket) => <DraggableTicket key={ticket.id} ticket={ticket} onOpen={onOpen} />)
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={intl.formatMessage({ id: 'tickets.empty' })} />
        )}
      </div>
    </div>
  );
};

/** 工单查询（F03）：按编号/关键字与状态、优先级、时间跨全量历史检索（不受看板三天窗口限制） */
const TicketSearch = ({ onOpen }: { onOpen: (ticket: Ticket) => void }) => {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<TicketStatus | undefined>();
  const [priority, setPriority] = useState<TicketPriority | undefined>();
  const [range, setRange] = useState<[Dayjs, Dayjs] | undefined>();
  const [results, setResults] = useState<Ticket[]>();
  const [searching, setSearching] = useState(false);

  const search = async () => {
    const trimmed = keyword.trim();
    if (!trimmed && !status && !priority && !range) {
      message.info(t('tickets.search.hint'));
      return;
    }
    setSearching(true);
    try {
      // 纯编号输入（如 WO-20261007-019 或 20261007-019）补全前缀后精确匹配
      const normalized = /^(wo-)?(\d{8}-.+)$/i.test(trimmed) ? `WO-${trimmed.replace(/^wo-/i, '')}` : trimmed;
      const page = await listTickets({
        keyword: normalized || undefined,
        status,
        priority,
        from: range?.[0]?.toISOString(),
        to: range?.[1]?.toISOString(),
        pageSize: 20,
      });
      setResults(page.list);
      if (!page.list.length) message.info(t('tickets.search.empty'));
    } finally {
      setSearching(false);
    }
  };

  return (
    <Card size="small" className="mb-4" title={t('tickets.search.title')} data-tour="ticket-search">
      <Space wrap size={[12, 8]}>
        <Input.Search
          className="w-full sm:w-72"
          allowClear
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('tickets.search.placeholder')}
          onSearch={search}
          loading={searching}
          enterButton
        />
        <Select<TicketStatus>
          allowClear
          className="w-32"
          /* 无可见 <label>，placeholder 不算可访问名（axe label，critical）：显式给 aria-label */
          aria-label={t('tickets.search.status')}
          placeholder={t('tickets.search.status')}
          value={status}
          onChange={setStatus}
          options={TICKET_STATUS_KEYS.map((key) => ({ value: key, label: t(`ticketStatus.${key}`) }))}
        />
        <Select<TicketPriority>
          allowClear
          className="w-28"
          aria-label={t('tickets.search.priority')}
          placeholder={t('tickets.search.priority')}
          value={priority}
          onChange={setPriority}
          options={(['P1', 'P2', 'P3'] as const).map((key) => ({ value: key, label: key }))}
        />
        <DatePicker.RangePicker
          showTime={{ format: 'HH:mm' }}
          value={range}
          onChange={(value) => setRange(value?.[0] && value?.[1] ? [value[0], value[1]] : undefined)}
          placeholder={[t('tickets.search.from'), t('tickets.search.to')]}
        />
        <Button onClick={search} loading={searching}>
          {t('tickets.search.button')}
        </Button>
      </Space>
      {results && (
        <div className="mt-3 flex flex-col gap-1">
          {results.length ? (
            results.map((ticket) => (
              <Button key={ticket.id} type="link" size="small" className="!px-0" onClick={() => onOpen(ticket)}>
                {`${ticket.id} · ${ticket.title} · ${t(`ticketStatus.${ticket.status}`)}`}
              </Button>
            ))
          ) : (
            <Typography.Text type="secondary">{t('tickets.search.empty')}</Typography.Text>
          )}
        </div>
      )}
    </Card>
  );
};

export default function Tickets() {
  const intl = useIntl();
  // useCallback 包一层：下面的深链 effect 依赖它，行内函数每次渲染都是新引用会让 effect 反复执行
  const t = useCallback(
    (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values),
    [intl],
  );
  const { message } = App.useApp();
  const location = useLocation();
  const { data, loading } = useApi(() => listTickets({ board: true }));
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [kind, setKind] = useState<KindFilter>('all');
  const [dragging, setDragging] = useState<Ticket>();
  const [viewingId, setViewingId] = useState<string>();
  // 鼠标移动 6px 才算拖动（单击留给「查看详情」）；触屏长按 250ms 才拖动，否则是正常滚动页面
  // （此前用 PointerSensor：触屏上浏览器先接管滚动手势，卡片根本拖不动）；
  // 键盘只用空格拿起 / 放下，回车留给「查看详情」
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: columnJumpCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const focusId = useMemo(() => new URLSearchParams(location.search).get('focus') ?? undefined, [location.search]);

  useEffect(() => {
    // 看板数据刷新时保留看板窗口之外的工单（深链加载的历史工单），避免列表回写把它挤掉
    if (data)
      setTickets((current) => {
        const incoming = new Set(data.list.map((ticket) => ticket.id));
        return [...current.filter((ticket) => !incoming.has(ticket.id)), ...data.list];
      });
  }, [data]);

  // 深链接（F03）：?focus=WO-… 打开对应工单详情；不在看板窗口内（历史工单）时按 ID 独立加载。
  // focusResolved 是从 tickets 派生的布尔值：它在「看板数据到位且包含该工单」时翻转为 true，
  // 正好替代原先把 data 整个放进依赖数组的做法（依赖列表与 effect 实际读取的值一致，无需再禁用规则）
  const focusResolved = !focusId || tickets.some((ticket) => ticket.id === focusId);
  useEffect(() => {
    if (!focusId) return;
    if (focusResolved) {
      setViewingId(focusId);
      return;
    }
    let cancelled = false;
    void getTicket(focusId)
      .then((ticket) => {
        if (cancelled) return;
        setTickets((list) => (list.some((item) => item.id === ticket.id) ? list : [ticket, ...list]));
        setViewingId(ticket.id);
      })
      .catch(() => {
        if (!cancelled) message.error(t('tickets.focus.missing', { id: focusId }));
      });
    return () => {
      cancelled = true;
    };
  }, [focusId, focusResolved, t, message]);

  const viewing = tickets.find((ticket) => ticket.id === viewingId);
  const columns = useMemo(() => {
    const visible = tickets.filter((ticket) => kind === 'all' || ticket.kind === kind);
    return Object.fromEntries(
      TICKET_STATUS_KEYS.map((status) => [
        status,
        sortColumn(
          status,
          visible.filter((ticket) => ticket.status === status),
        ),
      ]),
    ) as Record<TicketStatus, Ticket[]>;
  }, [tickets, kind]);

  /** 乐观更新：先移动卡片，接口失败再退回（错误提示由请求层统一弹出）。拖拽与详情抽屉共用 */
  const move = async (ticket: Ticket, status: TicketStatus) => {
    if (status === ticket.status) return;
    // 只记录被移动那张卡的原状态：整表快照回滚会一并吞掉调用期间落地的其他变更
    // （看板刷新合并、第二张卡的移动、经办人变更）
    const previousStatus = ticket.status;
    setTickets((list) => list.map((item) => (item.id === ticket.id ? { ...item, status } : item)));
    try {
      const updated = await moveTicket(ticket.id, status);
      setTickets((list) => list.map((item) => (item.id === ticket.id ? updated : item)));
      message.success(t('tickets.moved', { id: ticket.id, status: t(`ticketStatus.${status}`) }));
    } catch {
      setTickets((list) => list.map((item) => (item.id === ticket.id ? { ...item, status: previousStatus } : item)));
    }
  };

  /** 打开详情；带 focus 参数时同步地址栏（可复制/刷新的深链接），关闭时移除 */
  const open = (ticket: Ticket) => {
    setViewingId(ticket.id);
    if (focusId !== ticket.id) {
      history.replace(`/ops/tickets?focus=${encodeURIComponent(ticket.id)}`);
    }
  };
  const close = () => {
    setViewingId(undefined);
    if (focusId) history.replace('/ops/tickets');
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(undefined);
    lastDragEndAt.current = Date.now();
    const ticket = tickets.find((item) => item.id === active.id);
    const status = over?.id as TicketStatus | undefined;
    if (ticket && status) void move(ticket, status);
  };

  return (
    <DemoPage
      descriptionId="page.tickets.desc"
      source="src/pages/Ops/Tickets/index.tsx"
      extra={
        <Segmented<KindFilter>
          value={kind}
          onChange={setKind}
          options={(['all', 'fault', 'maintenance'] as const).map((value) => ({
            value,
            label: t(`tickets.filter.${value}`),
          }))}
        />
      }
    >
      <Alert type="info" showIcon className="mb-4" title={t('tickets.dragHint')} />
      <TicketSearch onOpen={open} />
      <Skeleton active loading={loading && !data} paragraph={{ rows: 10 }}>
        <DndContext
          sensors={sensors}
          onDragStart={({ active }) => setDragging(tickets.find((item) => item.id === active.id))}
          onDragCancel={() => setDragging(undefined)}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TICKET_STATUS_KEYS.map((status) => (
              <Column key={status} status={status} tickets={columns[status]} onOpen={open} />
            ))}
          </div>
          <DragOverlay>{dragging && <TicketCard ticket={dragging} dragging />}</DragOverlay>
        </DndContext>
      </Skeleton>
      <TicketDrawer
        ticket={viewing}
        onMove={move}
        onClose={close}
        onChanged={(updated) => setTickets((list) => list.map((item) => (item.id === updated.id ? updated : item)))}
      />
    </DemoPage>
  );
}
