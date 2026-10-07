import UserAvatar from '@/components/UserAvatar';
import { TICKET_STATUS_KEYS } from '@/constants/enums';
import { PRIORITY_COLOR } from '@/constants/semantic';
import type { Ticket, TicketStatus } from '@/services/types';
import { humanizeDuration } from '@/utils/duration';
import { formatDateTime } from '@/utils/format';
import { useIntl } from '@umijs/max';
import { Descriptions, Drawer, Segmented, Space, Steps, Tag, Typography } from 'antd';
import { useSla } from './TicketCard';

const HOUR = 3_600_000;

// 流转时不禁用分段控件：禁用会让焦点掉到 body，之后按 Esc 关不掉抽屉
const MoveBar = ({ ticket, onMove }: { ticket: Ticket; onMove: (ticket: Ticket, status: TicketStatus) => void }) => {
  const intl = useIntl();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Typography.Text type="secondary">{intl.formatMessage({ id: 'tickets.moveTo' })}</Typography.Text>
      <Segmented<TicketStatus>
        value={ticket.status}
        onChange={(status) => onMove(ticket, status)}
        options={TICKET_STATUS_KEYS.map((status) => ({
          value: status,
          label: intl.formatMessage({ id: `ticketStatus.${status}` }),
        }))}
      />
    </div>
  );
};

const TicketDetail = ({ ticket }: { ticket: Ticket }) => {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const sla = useSla(ticket);
  const when = (value?: string) => (value ? formatDateTime(value, 'YYYY-MM-DD HH:mm') : undefined);
  const steps = [
    { key: 'created', at: ticket.createdAt },
    // 未开工的巡检显示计划开工时间
    { key: 'responded', at: ticket.respondedAt, planned: ticket.respondedAt ? undefined : ticket.scheduledAt },
    { key: 'resolved', at: ticket.resolvedAt },
    {
      key: 'accepted',
      at: ticket.acceptance?.signedAt,
      extra: ticket.acceptance && t('tickets.signedBy', { name: ticket.acceptance.signerName }),
    },
  ];
  const current = steps.findIndex((step) => !step.at);

  return (
    <>
      <Space size={4} className="mb-2">
        <Tag color={PRIORITY_COLOR[ticket.priority]}>{ticket.priority}</Tag>
        <Tag>{t(`ticketKind.${ticket.kind}`)}</Tag>
      </Space>
      <Typography.Title level={5} className="mt-0!">
        {ticket.title}
      </Typography.Title>
      <Descriptions column={1} size="small" bordered className="mt-4">
        <Descriptions.Item label={t('tickets.field.device')}>
          {ticket.deviceName} · {ticket.city}
        </Descriptions.Item>
        {ticket.alarmId && <Descriptions.Item label={t('tickets.field.alarm')}>{ticket.alarmId}</Descriptions.Item>}
        <Descriptions.Item label={t('tickets.field.assignee')}>
          <UserAvatar name={ticket.assigneeName} size={22} />
        </Descriptions.Item>
        <Descriptions.Item label={t('tickets.field.sla')}>
          {humanizeDuration(ticket.slaHours * HOUR, t)}
          <Typography.Text type="secondary"> · {t('tickets.field.deadline')} </Typography.Text>
          {formatDateTime(sla.deadline, 'MM-DD HH:mm')}
          <Typography.Text type={sla.danger ? 'danger' : 'secondary'} className="ml-2">
            {sla.text}
          </Typography.Text>
        </Descriptions.Item>
      </Descriptions>

      <Typography.Title level={5} className="mt-6">
        {t('tickets.progress')}
      </Typography.Title>
      <Steps
        direction="vertical"
        size="small"
        current={current === -1 ? steps.length : current}
        items={steps.map((step) => ({
          title: t(`tickets.step.${step.key}`),
          description: step.at
            ? [when(step.at), step.extra].filter(Boolean).join(' · ')
            : step.planned && t('tickets.scheduled', { time: formatDateTime(step.planned, 'MM-DD HH:mm') }),
        }))}
      />
      {ticket.acceptance && (
        <img
          src={ticket.acceptance.signature}
          alt={t('tickets.step.accepted')}
          className="mt-2 block max-h-28 rounded border border-solid bg-white"
          style={{ borderColor: 'rgba(0, 0, 0, 0.12)' }}
        />
      )}
    </>
  );
};

/**
 * 工单详情：基本信息、时限、处理进度（创建 → 开工 → 完成 → 验收），底部可直接流转状态。
 * 手机上拖拽不顺手（需长按），这里是等价的操作入口。
 */
export default function TicketDrawer({
  ticket,
  onMove,
  onClose,
}: {
  ticket?: Ticket;
  onMove: (ticket: Ticket, status: TicketStatus) => void;
  onClose: () => void;
}) {
  const intl = useIntl();
  return (
    <Drawer
      open={!!ticket}
      onClose={onClose}
      width={480}
      title={
        <Space>
          {intl.formatMessage({ id: 'tickets.detail' })}
          <Typography.Text type="secondary" className="font-normal">
            {ticket?.id}
          </Typography.Text>
        </Space>
      }
      destroyOnHidden
      footer={ticket && <MoveBar ticket={ticket} onMove={onMove} />}
    >
      {ticket && <TicketDetail ticket={ticket} />}
    </Drawer>
  );
}
