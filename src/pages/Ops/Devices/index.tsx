import DemoPage from '@/components/DemoPage';
import { DEVICE_STATUS_KEYS, REGION_KEYS } from '@/constants/enums';
import { LEVEL_COLOR } from '@/constants/semantic';
import { useApi } from '@/hooks/useApi';
import { useEnums } from '@/hooks/useEnums';
import { useResponsiveTable } from '@/hooks/useResponsiveTable';
import { getDevice, listDevices } from '@/services/ops';
import type { Device } from '@/services/types';
import { formatDateTime, fromNow } from '@/utils/format';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Badge, Descriptions, Drawer, Empty, List, Progress, Skeleton, Tag, Tooltip, Typography } from 'antd';
import { useState } from 'react';

const MODELS = ['MX-200', 'MX-300', 'RX-500'];

/** 在线率进度条颜色：≥99 绿、≥95 蓝、其余橙 */
const uptimeColor = (value: number) => (value >= 99 ? '#52c41a' : value >= 95 ? '#1677ff' : '#fa8c16');

const DeviceDrawer = ({ id, onClose }: { id?: string; onClose: () => void }) => {
  const intl = useIntl();
  const t = (key: string) => intl.formatMessage({ id: key });
  const enums = useEnums();
  const { data, loading } = useApi(() => (id ? getDevice(id) : Promise.resolve(undefined)), [id]);
  return (
    <Drawer open={!!id} onClose={onClose} width={520} title={t('devices.detail')} destroyOnHidden>
      <Skeleton active loading={loading || !data}>
        {data && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('devices.column.device')}>
                {data.name} <Typography.Text type="secondary">{data.id}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('alarms.column.location')}>
                {enums.label('region', data.region)} · {data.city}
              </Descriptions.Item>
              <Descriptions.Item label={t('devices.column.model')}>
                {data.model} · {data.firmware}
              </Descriptions.Item>
              <Descriptions.Item label={t('devices.column.band')}>
                {data.band[0]}–{data.band[1]} MHz
              </Descriptions.Item>
              <Descriptions.Item label={t('devices.column.status')}>
                <Badge
                  status={data.status === 'online' ? 'success' : data.status === 'fault' ? 'error' : 'default'}
                  text={enums.label('deviceStatus', data.status)}
                />
              </Descriptions.Item>
              <Descriptions.Item label={t('devices.column.uptime')}>{data.uptime30d}%</Descriptions.Item>
              <Descriptions.Item label={t('devices.column.signal')}>{data.signalDbm} dBm</Descriptions.Item>
              <Descriptions.Item label={t('devices.column.heartbeat')}>
                {formatDateTime(data.lastHeartbeatAt, 'YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label={t('devices.column.installedAt')}>
                {formatDateTime(data.installedAt, 'YYYY-MM-DD')}
              </Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5} className="mt-8">
              {t('devices.recentAlarms')}
            </Typography.Title>
            {data.recentAlarms.length ? (
              <List
                size="small"
                dataSource={data.recentAlarms}
                renderItem={(alarm) => (
                  <List.Item
                    extra={<Typography.Text type="secondary">{fromNow(alarm.occurredAt, intl.locale)}</Typography.Text>}
                  >
                    <Tag color={LEVEL_COLOR[alarm.level]}>{enums.label('alarmLevel', alarm.level)}</Tag>
                    {enums.label('alarmType', alarm.type)}
                    <Typography.Text type="secondary"> · {enums.label('alarmStatus', alarm.status)}</Typography.Text>
                  </List.Item>
                )}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('devices.noAlarms')} />
            )}
          </>
        )}
      </Skeleton>
    </Drawer>
  );
};

export default function Devices() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const enums = useEnums();
  const [viewing, setViewing] = useState<string>();
  const table = useResponsiveTable();

  const columns: ProColumns<Device>[] = [
    {
      title: t('users.keyword'),
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: t('devices.keywordPlaceholder') },
    },
    {
      title: t('devices.column.device'),
      dataIndex: 'name',
      search: false,
      width: 180,
      render: (_, device) => (
        <Typography.Link onClick={() => setViewing(device.id)}>
          <span className="block">{device.name}</span>
          <Typography.Text type="secondary" className="text-xs">
            {device.id}
          </Typography.Text>
        </Typography.Link>
      ),
    },
    // 大区只作筛选项；表格里与城市合并成一列「位置」（与告警中心一致），省出一列宽度
    {
      title: t('devices.column.region'),
      dataIndex: 'region',
      hideInTable: true,
      valueEnum: enums.valueEnum('region', REGION_KEYS),
    },
    {
      title: t('alarms.column.location'),
      dataIndex: 'city',
      search: false,
      width: 140,
      render: (_, device) => `${enums.label('region', device.region)} · ${device.city}`,
    },
    {
      title: t('devices.column.model'),
      dataIndex: 'model',
      width: 100,
      valueEnum: Object.fromEntries(MODELS.map((m) => [m, { text: m }])),
    },
    {
      title: t('devices.column.band'),
      dataIndex: 'band',
      search: false,
      width: 130,
      render: (_, device) => `${device.band[0]}–${device.band[1]} MHz`,
    },
    {
      title: t('devices.column.status'),
      dataIndex: 'status',
      width: 100,
      valueEnum: enums.valueEnum('deviceStatus', DEVICE_STATUS_KEYS, (key) => ({
        status: { online: 'Success', offline: 'Default', fault: 'Error' }[key],
      })),
    },
    {
      title: t('devices.column.uptime'),
      dataIndex: 'uptime30d',
      search: false,
      sorter: true,
      width: 150,
      render: (_, device) => (
        <Progress
          percent={device.uptime30d}
          size="small"
          strokeColor={uptimeColor(device.uptime30d)}
          format={(value) => `${value}%`}
        />
      ),
    },
    {
      title: t('devices.column.signal'),
      dataIndex: 'signalDbm',
      search: false,
      sorter: true,
      width: 110,
      render: (_, device) => `${device.signalDbm} dBm`,
    },
    {
      title: t('devices.column.heartbeat'),
      dataIndex: 'lastHeartbeatAt',
      search: false,
      sorter: true,
      width: 120,
      render: (_, device) => (
        <Tooltip title={formatDateTime(device.lastHeartbeatAt, 'YYYY-MM-DD HH:mm:ss')}>
          {fromNow(device.lastHeartbeatAt, intl.locale)}
        </Tooltip>
      ),
    },
    { title: t('devices.column.firmware'), dataIndex: 'firmware', search: false, width: 90, responsive: ['xxl'] },
  ];

  return (
    <DemoPage descriptionId="page.devices.desc" source="src/pages/Ops/Devices/index.tsx">
      <ProTable<Device>
        rowKey="id"
        columns={columns}
        scroll={table.scroll}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 10, showSizeChanger: true }}
        request={async (params, sort) => {
          const [sortField, order] = Object.entries(sort ?? {})[0] ?? [];
          const page = await listDevices({ ...params, sortField, sortOrder: order ?? undefined });
          return { data: page.list, total: page.total, success: true };
        }}
      />
      <DeviceDrawer id={viewing} onClose={() => setViewing(undefined)} />
    </DemoPage>
  );
}
