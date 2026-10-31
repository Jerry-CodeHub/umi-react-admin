import SemanticTag from '@/components/SemanticTag';
import UserAvatar from '@/components/UserAvatar';
import { TICKET_STATUS_KEYS } from '@/constants/enums';
import { PRIORITY_COLOR } from '@/constants/semantic';
import { moveTicket, reworkTicket } from '@/services/ops';
import type { Ticket, TicketStatus, User } from '@/services/types';
import { listUsers } from '@/services/users';
import { humanizeDuration } from '@/utils/duration';
import { formatDateTime } from '@/utils/format';
import { safeSignature } from '@/utils/signature';
import { useAccess, useIntl } from '@umijs/max';
import { App, Button, Descriptions, Drawer, Segmented, Select, Space, Steps, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useSla } from './TicketCard';

const HOUR = 3_600_000;

/** 可派工处理人选择（E05：无需拖拽即可完成「选择处理人 → 处理 → 完成」） */
const AssigneeSelect = ({ ticket, onChanged }: { ticket: Ticket; onChanged?: (ticket: Ticket) => void }) => {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const access = useAccess();
  const { message } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const assignable = users.filter((u) => u.status === 'active' && (u.role === 'operator' || u.role === 'lead'));

  useEffect(() => {
    if (!access.permission('ops.ticket.assign')) return;
    let cancelled = false;
    // 服务端按角色过滤（UserQuery.role）：此前「pageSize 200 全量捞再客户端筛 operator/lead」，
    // 活跃用户超过 200 时选择器会静默丢候选人
    void Promise.all([
      listUsers({ status: 'active', role: 'operator', pageSize: 100 }),
      listUsers({ status: 'active', role: 'lead', pageSize: 100 }),
    ])
      .then(([operators, leads]) => {
        if (!cancelled) setUsers([...operators.list, ...leads.list]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [access]);

  if (!access.permission('ops.ticket.assign')) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Typography.Text type="secondary">{t('tickets.field.assignee')}</Typography.Text>
      <Select
        className="min-w-44"
        size="small"
        /* 可见文字只是旁边的说明，不构成 <label> 关联（axe label）：显式给 aria-label */
        aria-label={t('tickets.field.assignee')}
        value={ticket.assigneeId}
        optionFilterProp="label"
        showSearch
        options={assignable.map((user) => ({ value: user.id, label: `${user.name} · ${user.id}` }))}
        onChange={async (assigneeId) => {
          try {
            const updated = await moveTicket(ticket.id, ticket.status, assigneeId);
            onChanged?.(updated);
            message.success(t('tickets.assigned', { id: ticket.id }));
          } catch {
            message.error(t('tickets.assignFailed'));
          }
        }}
      />
    </div>
  );
};

// 流转时不禁用分段控件：禁用会让焦点掉到 body，之后按 Esc 关不掉抽屉
const MoveBar = ({
  ticket,
  onMove,
  onRework,
}: {
  ticket: Ticket;
  onMove: (ticket: Ticket, status: TicketStatus) => void;
  onRework: (ticket: Ticket) => void;
}) => {
  const intl = useIntl();
  const access = useAccess();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  // 目标权限按演示后端口径：开工/完成 = ops.ticket.close；退回/离开完成 = ops.ticket.assign。
  // done 工单的任何流转都是「离开完成」，只给派工权限持有者选项（复查 P3-4：避免点了被 403 整页跳走）
  const canClose = access.permission('ops.ticket.close');
  const canAssign = access.permission('ops.ticket.assign');
  const options = TICKET_STATUS_KEYS.filter((status) =>
    ticket.status === 'done' ? canAssign : status === 'todo' ? canAssign : canClose,
  ).map((status) => ({ value: status, label: intl.formatMessage({ id: `ticketStatus.${status}` }) }));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Typography.Text type="secondary">{intl.formatMessage({ id: 'tickets.moveTo' })}</Typography.Text>
      <Space size={8} wrap>
        {options.length > 0 && (
          <Segmented<TicketStatus>
            value={ticket.status}
            onChange={(status) => onMove(ticket, status)}
            options={options}
          />
        )}
        {/* 已完成的工单提供显式返工入口（F06）：旧验收归档失效，工单回到处理中 */}
        {ticket.status === 'done' && canAssign && (
          <Button size="small" danger onClick={() => onRework(ticket)}>
            {t('tickets.rework')}
          </Button>
        )}
      </Space>
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
  const signature = safeSignature(ticket.acceptance?.signature);

  return (
    <>
      <Space size={4} className="mb-2" wrap>
        <SemanticTag tone={PRIORITY_COLOR[ticket.priority]}>{ticket.priority}</SemanticTag>
        <Tag>{t(`ticketKind.${ticket.kind}`)}</Tag>
        {/* 「Success」不是 antd 的状态色 key（大小写不匹配会走自定义色分支，暗色主题下渲染成近白底白字）：改用小写状态色 */}
        {ticket.acceptance && <Tag color="success">{t('tickets.acceptedTag')}</Tag>}
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
        orientation="vertical"
        size="small"
        current={current === -1 ? steps.length : current}
        items={steps.map((step) => ({
          title: t(`tickets.step.${step.key}`),
          // antd 6：items.description 已弃用，改用 items.content
          content: step.at
            ? [when(step.at), step.extra].filter(Boolean).join(' · ')
            : step.planned && t('tickets.scheduled', { time: formatDateTime(step.planned, 'MM-DD HH:mm') }),
        }))}
      />
      {signature && (
        <img
          src={signature}
          alt={t('tickets.step.accepted')}
          className="mt-2 block max-h-28 rounded border border-solid bg-white"
          style={{ borderColor: 'rgba(0, 0, 0, 0.12)' }}
        />
      )}
      {(ticket.acceptanceHistory?.length ?? 0) > 0 && (
        <>
          <Typography.Title level={5} className="mt-6">
            {t('tickets.acceptanceHistory')}
          </Typography.Title>
          <div className="flex flex-col gap-2">
            {ticket.acceptanceHistory!.map((record, index) => {
              const historySignature = safeSignature(record.signature);
              return (
                <div
                  key={`${record.signedAt}-${index}`}
                  className="rounded border border-dashed p-2"
                  style={{ opacity: 0.75 }}
                >
                  <Typography.Text delete type="secondary">
                    {t('tickets.signedBy', {
                      name: record.signerName,
                      time: formatDateTime(record.signedAt, 'YYYY-MM-DD HH:mm'),
                    })}
                  </Typography.Text>
                  <Typography.Text type="secondary" className="ml-2 text-xs">
                    {t('tickets.acceptanceInvalidated', {
                      time: formatDateTime(record.invalidatedAt, 'YYYY-MM-DD HH:mm'),
                      name: record.invalidatorName ?? '',
                    })}
                  </Typography.Text>
                  {historySignature && (
                    <img
                      src={historySignature}
                      alt={t('tickets.acceptanceHistory')}
                      className="mt-1 block max-h-20 rounded border border-solid bg-white"
                      style={{ borderColor: 'rgba(0, 0, 0, 0.12)' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
};

/**
 * 工单详情：基本信息、时限、处理进度（创建 → 开工 → 完成 → 验收）、失效验收留痕与返工入口，
 * 底部可直接流转状态（按权限点过滤目标状态）。手机上拖拽不顺手（需长按），这里是等价的操作入口。
 */
export default function TicketDrawer({
  ticket,
  onMove,
  onClose,
  onChanged,
}: {
  ticket?: Ticket;
  onMove: (ticket: Ticket, status: TicketStatus) => void;
  onClose: () => void;
  /** 详情内的变更（改派、返工）回写看板列表 */
  onChanged?: (ticket: Ticket) => void;
}) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const { message, modal } = App.useApp();

  const handleRework = (target: Ticket) => {
    modal.confirm({
      title: t('tickets.reworkConfirm'),
      content: t('tickets.reworkConfirmDesc'),
      okText: t('tickets.rework'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const updated = await reworkTicket(target.id);
          onChanged?.(updated);
          message.success(t('tickets.reworkDone', { id: target.id }));
        } catch {
          message.error(t('tickets.reworkFailed'));
        }
      },
    });
  };

  return (
    <Drawer
      open={!!ticket}
      onClose={onClose}
      // antd 6：Drawer 的 width 已弃用，size 直接接受像素值
      size={480}
      title={
        <Space>
          {intl.formatMessage({ id: 'tickets.detail' })}
          <Typography.Text type="secondary" className="font-normal">
            {ticket?.id}
          </Typography.Text>
        </Space>
      }
      destroyOnHidden
      footer={ticket && <MoveBar ticket={ticket} onMove={onMove} onRework={handleRework} />}
    >
      {ticket && (
        <>
          <TicketDetail ticket={ticket} />
          <AssigneeSelect ticket={ticket} onChanged={onChanged} />
        </>
      )}
    </Drawer>
  );
}
