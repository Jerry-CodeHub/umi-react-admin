import DemoPage from '@/components/DemoPage';
import UserAvatar from '@/components/UserAvatar';
import { LOG_ACTION_KEYS } from '@/constants/enums';
import { useEnums } from '@/hooks/useEnums';
import { listLogs } from '@/services/system';
import type { LogAction, OperationLog } from '@/services/types';
import { formatDateTime, fromNow } from '@/utils/format';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Tag, Tooltip } from 'antd';

/** 操作类别着色：登录类中性、管理类蓝、处置类紫、导出绿 */
const ACTION_COLOR: Partial<Record<LogAction, string>> = {
  userCreate: 'blue',
  userUpdate: 'blue',
  userDisable: 'orange',
  roleUpdate: 'blue',
  alarmHandle: 'purple',
  ticketAssign: 'purple',
  ticketClose: 'green',
  reportExport: 'cyan',
};

export default function Logs() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const enums = useEnums();

  const columns: ProColumns<OperationLog>[] = [
    {
      title: t('users.keyword'),
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: t('logs.keywordPlaceholder') },
    },
    {
      title: t('logs.column.time'),
      dataIndex: 'createdAt',
      valueType: 'dateTimeRange',
      width: 170,
      search: { transform: ([from, to]: [string, string]) => ({ from, to }) },
      render: (_, log) => (
        <Tooltip title={fromNow(log.createdAt, intl.locale)}>
          {formatDateTime(log.createdAt, 'YYYY-MM-DD HH:mm:ss')}
        </Tooltip>
      ),
    },
    {
      title: t('logs.column.actor'),
      dataIndex: 'actorName',
      search: false,
      width: 160,
      render: (_, log) => <UserAvatar name={log.actorName} size={24} />,
    },
    {
      title: t('logs.column.action'),
      dataIndex: 'action',
      width: 140,
      valueEnum: enums.valueEnum('logAction', LOG_ACTION_KEYS),
      render: (_, log) => <Tag color={ACTION_COLOR[log.action]}>{enums.label('logAction', log.action)}</Tag>,
    },
    {
      title: t('logs.column.target'),
      dataIndex: 'target',
      search: false,
      ellipsis: true,
      render: (_, log) => log.target || t('common.none'),
    },
    {
      title: t('logs.column.result'),
      dataIndex: 'result',
      width: 100,
      valueEnum: enums.valueEnum('logResult', ['success', 'failure'] as const, (key) => ({
        status: key === 'success' ? 'Success' : 'Error',
      })),
    },
    { title: t('logs.column.ip'), dataIndex: 'ip', search: false, width: 140 },
    { title: t('logs.column.client'), dataIndex: 'userAgent', search: false, width: 170, responsive: ['xl'] },
  ];

  return (
    <DemoPage descriptionId="page.logs.desc" source="src/pages/System/Logs/index.tsx">
      <ProTable<OperationLog>
        rowKey="id"
        columns={columns}
        scroll={{ x: 1000 }}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        request={async (params) => {
          const page = await listLogs(params);
          return { data: page.list, total: page.total, success: true };
        }}
      />
    </DemoPage>
  );
}
