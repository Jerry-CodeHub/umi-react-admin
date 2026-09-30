import DemoPage from '@/components/DemoPage';
import { ALARM_LEVEL_KEYS, ALARM_STATUS_KEYS, ALARM_TYPE_KEYS, REGION_KEYS } from '@/constants/enums';
import { LEVEL_COLOR } from '@/constants/semantic';
import { useEnums } from '@/hooks/useEnums';
import { handleAlarm, listAlarms } from '@/services/ops';
import type { Alarm, AlarmHandleAction } from '@/services/types';
import { humanizeDuration } from '@/utils/duration';
import { formatDateTime, fromNow } from '@/utils/format';
import { DownOutlined } from '@ant-design/icons';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Link, useIntl } from '@umijs/max';
import { App, Button, Dropdown, Switch, Tag, Tooltip, Typography } from 'antd';
import { useRef, useState } from 'react';

const ACTIONS: AlarmHandleAction[] = ['ticket', 'recover', 'falsePositive'];

export default function Alarms() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const enums = useEnums();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(undefined);
  const [activeOnly, setActiveOnly] = useState(false);

  const handle = async (alarm: Alarm, action: AlarmHandleAction) => {
    await handleAlarm(alarm.id, action);
    message.success(t('alarms.handled'));
    actionRef.current?.reload();
  };

  const columns: ProColumns<Alarm>[] = [
    {
      title: t('users.keyword'),
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: t('alarms.keywordPlaceholder') },
    },
    {
      title: t('alarms.column.level'),
      dataIndex: 'level',
      width: 80,
      valueEnum: enums.valueEnum('alarmLevel', ALARM_LEVEL_KEYS),
      render: (_, alarm) => <Tag color={LEVEL_COLOR[alarm.level]}>{enums.label('alarmLevel', alarm.level)}</Tag>,
    },
    {
      title: t('alarms.column.type'),
      dataIndex: 'type',
      width: 110,
      valueEnum: enums.valueEnum('alarmType', ALARM_TYPE_KEYS),
    },
    {
      title: t('alarms.column.device'),
      dataIndex: 'deviceName',
      search: false,
      width: 190,
      render: (_, alarm) => (
        <div>
          <div>{alarm.deviceName}</div>
          <Typography.Text type="secondary" className="text-xs">
            {alarm.id}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: t('alarms.column.location'),
      dataIndex: 'region',
      width: 120,
      valueEnum: enums.valueEnum('region', REGION_KEYS),
      render: (_, alarm) => `${enums.label('region', alarm.region)} · ${alarm.city}`,
    },
    {
      title: t('alarms.column.occurredAt'),
      dataIndex: 'occurredAt',
      valueType: 'dateTimeRange',
      width: 160,
      search: { transform: ([from, to]: [string, string]) => ({ from, to }) },
      render: (_, alarm) => (
        <Tooltip title={fromNow(alarm.occurredAt, intl.locale)}>
          {formatDateTime(alarm.occurredAt, 'MM-DD HH:mm:ss')}
        </Tooltip>
      ),
    },
    {
      title: t('alarms.column.duration'),
      dataIndex: 'recoveredAt',
      search: false,
      width: 130,
      render: (_, alarm) => {
        const end = alarm.recoveredAt ? new Date(alarm.recoveredAt).getTime() : Date.now();
        const text = humanizeDuration(end - new Date(alarm.occurredAt).getTime(), t);
        return alarm.recoveredAt ? (
          text
        ) : (
          <Typography.Text type="warning">{t('alarms.ongoing', { duration: text })}</Typography.Text>
        );
      },
    },
    {
      title: t('alarms.column.status'),
      dataIndex: 'status',
      width: 150,
      valueEnum: enums.valueEnum('alarmStatus', ALARM_STATUS_KEYS, (key) => ({
        status: { active: 'Error', recovered: 'Success', ticketed: 'Processing', falsePositive: 'Default' }[key],
      })),
      render: (dom, alarm) =>
        alarm.ticketId ? (
          <div>
            {dom}
            <Link to="/ops/tickets" className="block text-xs">
              {alarm.ticketId}
            </Link>
          </div>
        ) : (
          dom
        ),
    },
    {
      title: t('alarms.column.source'),
      dataIndex: 'source',
      search: false,
      width: 100,
      responsive: ['xl'],
      render: (_, alarm) => enums.label('alarmSource', alarm.source),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 100,
      fixed: 'right',
      render: (_, alarm) =>
        alarm.status === 'active' ? (
          <Dropdown
            menu={{
              items: ACTIONS.map((action) => ({ key: action, label: t(`alarms.handle.${action}`) })),
              onClick: ({ key }) => handle(alarm, key as AlarmHandleAction),
            }}
          >
            <Button type="link" size="small">
              {t('alarms.handle')} <DownOutlined />
            </Button>
          </Dropdown>
        ) : null,
    },
  ];

  return (
    <DemoPage descriptionId="page.alarms.desc" source="src/pages/Ops/Alarms/index.tsx">
      <ProTable<Alarm>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        scroll={{ x: 1300 }}
        search={{ labelWidth: 'auto' }}
        params={{ activeOnly }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        toolBarRender={() => [
          <span key="active" className="flex items-center gap-2">
            <Switch size="small" checked={activeOnly} onChange={setActiveOnly} />
            {t('alarms.activeOnly')}
          </span>,
        ]}
        request={async ({ activeOnly: onlyActive, ...params }) => {
          const page = await listAlarms({ ...params, status: onlyActive ? 'active' : params.status });
          return { data: page.list, total: page.total, success: true };
        }}
      />
    </DemoPage>
  );
}
