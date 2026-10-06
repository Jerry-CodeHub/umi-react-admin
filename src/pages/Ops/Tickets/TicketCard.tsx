import UserAvatar from '@/components/UserAvatar';
import { PRIORITY_COLOR } from '@/constants/semantic';
import type { Ticket } from '@/services/types';
import { humanizeDuration } from '@/utils/duration';
import { formatDateTime, fromNow } from '@/utils/format';
import { CalendarOutlined, CheckCircleOutlined, ToolOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Card, Tag, Tooltip, Typography, theme } from 'antd';

const HOUR = 3_600_000;

/**
 * 时限状态：已排期未开工的巡检看计划开工日；进行中看剩余 / 超时；已完成看是否在时限内。
 * 卡片与详情抽屉共用
 */
export const useSla = (ticket: Ticket) => {
  const intl = useIntl();
  const t = (id: string, values: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const deadline = new Date(ticket.createdAt).getTime() + ticket.slaHours * HOUR;
  if (ticket.resolvedAt) {
    const met = new Date(ticket.resolvedAt).getTime() <= deadline;
    return { text: intl.formatMessage({ id: met ? 'tickets.sla.met' : 'tickets.sla.missed' }), danger: !met, deadline };
  }
  if (ticket.status === 'todo' && ticket.scheduledAt && new Date(ticket.scheduledAt).getTime() > Date.now()) {
    return {
      text: t('tickets.scheduled', { time: formatDateTime(ticket.scheduledAt, 'MM-DD') }),
      danger: false,
      deadline,
    };
  }
  const left = deadline - Date.now();
  return left >= 0
    ? { text: t('tickets.sla.left', { duration: humanizeDuration(left, t) }), danger: left < 2 * HOUR, deadline }
    : { text: t('tickets.sla.overdue', { duration: humanizeDuration(left, t) }), danger: true, deadline };
};

export default function TicketCard({ ticket, dragging }: { ticket: Ticket; dragging?: boolean }) {
  const intl = useIntl();
  const { token } = theme.useToken();
  const sla = useSla(ticket);
  return (
    <Card
      size="small"
      className="select-none"
      styles={{ body: { padding: 12 } }}
      style={{
        boxShadow: dragging ? token.boxShadowSecondary : undefined,
        cursor: dragging ? 'grabbing' : 'grab',
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1">
          <Tag color={PRIORITY_COLOR[ticket.priority]} className="m-0!">
            {ticket.priority}
          </Tag>
          <Typography.Text type="secondary" className="text-xs">
            {ticket.id}
          </Typography.Text>
        </span>
        <Tooltip title={intl.formatMessage({ id: `ticketKind.${ticket.kind}` })}>
          {ticket.kind === 'fault' ? (
            <ToolOutlined className="opacity-50" />
          ) : (
            <CalendarOutlined className="opacity-50" />
          )}
        </Tooltip>
      </div>
      <Typography.Paragraph ellipsis={{ rows: 2 }} className="mb-2! leading-snug">
        {ticket.title}
      </Typography.Paragraph>
      <div className="flex items-center justify-between gap-2 text-xs">
        <UserAvatar name={ticket.assigneeName} size={20} />
        <Typography.Text type={sla.danger ? 'danger' : 'secondary'} className="shrink-0 text-xs">
          {sla.text}
        </Typography.Text>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <Typography.Text type="secondary" className="text-xs">
          {fromNow(ticket.createdAt, intl.locale)}
        </Typography.Text>
        {ticket.acceptance && (
          <Typography.Text type="success" className="text-xs">
            <CheckCircleOutlined /> {intl.formatMessage({ id: 'tickets.signed' })}
          </Typography.Text>
        )}
      </div>
    </Card>
  );
}
