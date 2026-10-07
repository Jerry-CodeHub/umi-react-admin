import { DEVICE_STATUS_KEYS } from '@/constants/enums';
import { DEVICE_STATUS_CSS as STATUS_CSS } from '@/constants/semantic';
import { useEnums } from '@/hooks/useEnums';
import type { Device, DeviceStatus } from '@/services/types';
import { fromNow } from '@/utils/format';
import { useIntl } from '@umijs/max';
import { Badge, Card, Segmented, Space } from 'antd';

export type StatusFilter = 'all' | DeviceStatus;

/** 状态筛选（带数量） */
export const StatusFilterBar = ({
  devices,
  value,
  onChange,
}: {
  devices: Device[];
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}) => {
  const intl = useIntl();
  const enums = useEnums();
  const count = (status: StatusFilter) =>
    status === 'all' ? devices.length : devices.filter((d) => d.status === status).length;
  return (
    <Segmented<StatusFilter>
      value={value}
      onChange={onChange}
      options={(['all', ...DEVICE_STATUS_KEYS] as StatusFilter[]).map((status) => ({
        value: status,
        label: `${status === 'all' ? intl.formatMessage({ id: 'common.all' }) : enums.label('deviceStatus', status)} ${count(status)}`,
      }))}
    />
  );
};

/** 地图左上角的状态图例 */
export const StatusLegend = () => {
  const intl = useIntl();
  const enums = useEnums();
  return (
    <Card size="small" className="pointer-events-none opacity-95">
      <div className="mb-1 text-xs opacity-70">{intl.formatMessage({ id: 'map.legend.status' })}</div>
      <Space direction="vertical" size={0}>
        {DEVICE_STATUS_KEYS.map((status) => (
          <Badge key={status} color={STATUS_CSS[status]} text={enums.label('deviceStatus', status)} />
        ))}
      </Space>
    </Card>
  );
};

/** 站点弹窗内容（高德 InfoWindow 与 OpenLayers Overlay 共用） */
export const StationCard = ({ device }: { device: Device }) => {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const enums = useEnums();
  return (
    <div className="min-w-56 text-[13px] leading-6">
      <div className="mb-1 flex items-center justify-between gap-3 font-medium">
        {device.name}
        <Badge color={STATUS_CSS[device.status]} text={enums.label('deviceStatus', device.status)} />
      </div>
      <div className="opacity-70">{device.id}</div>
      <div>
        {t('map.device.region')}: {enums.label('region', device.region)} · {device.city}
      </div>
      <div>
        {t('map.device.model')}: {device.model} ({device.band[0]}–{device.band[1]} MHz)
      </div>
      <div>
        {t('map.device.uptime')}: {device.uptime30d}%
      </div>
      <div>
        {t('map.device.heartbeat')}: {fromNow(device.lastHeartbeatAt, intl.locale)}
      </div>
    </div>
  );
};
