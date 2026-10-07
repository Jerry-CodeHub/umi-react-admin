import DemoPage from '@/components/DemoPage';
import { TICKET_STATUS_KEYS } from '@/constants/enums';
import { TICKET_STATUS_COLOR } from '@/constants/semantic';
import { useApi } from '@/hooks/useApi';
import { useChartTheme } from '@/hooks/useChartTheme';
import { listTickets, moveTicket } from '@/services/ops';
import type { Ticket, TicketStatus } from '@/services/types';
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
import { useIntl } from '@umijs/max';
import { Alert, App, Badge, Empty, Segmented, Skeleton, Typography, theme } from 'antd';
import { useEffect, useMemo, useState } from 'react';
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

/** 点击 / 回车打开详情；拖动（鼠标移动 6px 以上、触屏长按）才进入拖拽，二者不冲突 */
const DraggableTicket = ({ ticket, onOpen }: { ticket: Ticket; onOpen: (ticket: Ticket) => void }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ticket.id, data: { ticket } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(ticket)}
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
      <div className="flex flex-col gap-2">
        {tickets.length ? (
          tickets.map((ticket) => <DraggableTicket key={ticket.id} ticket={ticket} onOpen={onOpen} />)
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={intl.formatMessage({ id: 'tickets.empty' })} />
        )}
      </div>
    </div>
  );
};

export default function Tickets() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const { data, loading } = useApi(() => listTickets({ board: true }));
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [kind, setKind] = useState<KindFilter>('all');
  const [dragging, setDragging] = useState<Ticket>();
  const [viewingId, setViewingId] = useState<string>();
  const viewing = tickets.find((ticket) => ticket.id === viewingId);
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

  useEffect(() => {
    if (data) setTickets(data.list);
  }, [data]);

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
    const previous = tickets;
    setTickets((list) => list.map((item) => (item.id === ticket.id ? { ...item, status } : item)));
    try {
      const updated = await moveTicket(ticket.id, status);
      setTickets((list) => list.map((item) => (item.id === ticket.id ? updated : item)));
      message.success(t('tickets.moved', { id: ticket.id, status: t(`ticketStatus.${status}`) }));
    } catch {
      setTickets(previous);
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(undefined);
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
      <Alert type="info" showIcon className="mb-4" message={t('tickets.dragHint')} />
      <Skeleton active loading={loading && !data} paragraph={{ rows: 10 }}>
        <DndContext
          sensors={sensors}
          onDragStart={({ active }) => setDragging(tickets.find((item) => item.id === active.id))}
          onDragCancel={() => setDragging(undefined)}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TICKET_STATUS_KEYS.map((status) => (
              <Column
                key={status}
                status={status}
                tickets={columns[status]}
                onOpen={(ticket) => setViewingId(ticket.id)}
              />
            ))}
          </div>
          <DragOverlay>{dragging && <TicketCard ticket={dragging} dragging />}</DragOverlay>
        </DndContext>
      </Skeleton>
      <TicketDrawer ticket={viewing} onMove={move} onClose={() => setViewingId(undefined)} />
    </DemoPage>
  );
}
