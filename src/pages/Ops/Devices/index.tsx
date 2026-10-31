import DemoPage from '@/components/DemoPage';
import SemanticTag from '@/components/SemanticTag';
import { DEVICE_STATUS_KEYS, REGION_KEYS } from '@/constants/enums';
import { LEVEL_COLOR } from '@/constants/semantic';
import { useApi } from '@/hooks/useApi';
import { useEnums } from '@/hooks/useEnums';
import { useResponsiveTable } from '@/hooks/useResponsiveTable';
import { getDevice, listDevices } from '@/services/ops';
import type { Device } from '@/services/types';
import { formatDateTime, fromNow } from '@/utils/format';
import { AimOutlined } from '@ant-design/icons';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { history, Link, useIntl } from '@umijs/max';
import {
  Badge,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Listy,
  Progress,
  Result,
  Skeleton,
  theme,
  Tooltip,
  Typography,
} from 'antd';
import { useState } from 'react';

const MODELS = ['MX-200', 'MX-300', 'RX-500'];

/**
 * 在线率进度条颜色：≥99 绿、≥95 蓝、其余橙。取当前主题的 token（浅色主题是深档、暗色主题是亮档）：
 * 进度条右侧的百分比文字会继承这个颜色（axe color-contrast），固定写死的 #52c41a / #1677ff / #fa8c16
 * 在白底只有 2.26~4.10:1，达不到 AA。用 token 后浅色 5.43~6.16:1、暗色 6.16~9.94:1。
 */
const uptimeColor = (value: number, token: { colorSuccess: string; colorLink: string; colorWarning: string }) =>
  value >= 99 ? token.colorSuccess : value >= 95 ? token.colorLink : token.colorWarning;

const DeviceDrawer = ({ id, onClose }: { id?: string; onClose: () => void }) => {
  const intl = useIntl();
  const t = (key: string) => intl.formatMessage({ id: key });
  const enums = useEnums();
  const { data, loading, error, reload } = useApi(() => (id ? getDevice(id) : Promise.resolve(undefined)), [id]);
  return (
    <Drawer open={!!id} onClose={onClose} size={520} title={t('devices.detail')} destroyOnHidden>
      {error ? (
        // 拉取失败不再伪装成永久骨架：给出失败态与重试（请求层已 toast 过原因）
        <Result
          status="warning"
          title={t('common.loadFailed')}
          extra={
            <Button onClick={reload} loading={loading}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
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
              {/* 同一业务对象的跳转链（E03）：地图定位 + 告警明细，浏览器返回可回到这里 */}
              <Button
                className="mt-4"
                icon={<AimOutlined />}
                data-tour="device-locate"
                onClick={() => history.push(`/map/openlayers?focus=${encodeURIComponent(data.id)}`)}
              >
                {t('devices.locateOnMap')}
              </Button>
              <Typography.Title level={5} className="mt-8">
                {t('devices.recentAlarms')}
              </Typography.Title>
              {data.recentAlarms.length ? (
                <Listy
                  items={data.recentAlarms}
                  rowKey="id"
                  styles={{ item: { paddingBlock: 8, paddingInline: 0 } }}
                  itemRender={(alarm) => (
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <SemanticTag tone={LEVEL_COLOR[alarm.level]}>
                          {enums.label('alarmLevel', alarm.level)}
                        </SemanticTag>
                        <Link to={`/ops/alarms?keyword=${encodeURIComponent(alarm.id)}`}>
                          {enums.label('alarmType', alarm.type)}
                        </Link>
                        <Typography.Text type="secondary">
                          {' '}
                          · {enums.label('alarmStatus', alarm.status)}
                        </Typography.Text>
                      </span>
                      <Typography.Text type="secondary">{fromNow(alarm.occurredAt, intl.locale)}</Typography.Text>
                    </div>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('devices.noAlarms')} />
              )}
            </>
          )}
        </Skeleton>
      )}
    </Drawer>
  );
};

export default function Devices() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { token } = theme.useToken();
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
          strokeColor={uptimeColor(device.uptime30d, token)}
          format={(value) => `${value}%`}
          /* role="progressbar" 没有可见名称（axe aria-progressbar-name）：带上设备名 + 列名 */
          aria-label={`${device.name} ${t('devices.column.uptime')}`}
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
