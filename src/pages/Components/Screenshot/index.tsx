import DemoPage from '@/components/DemoPage';
import SemanticTag from '@/components/SemanticTag';
import { LEVEL_COLOR } from '@/constants/semantic';
import { useApi } from '@/hooks/useApi';
import { useChartTheme } from '@/hooks/useChartTheme';
import { getDevice, listAlarms, listAllDevices } from '@/services/ops';
import type { Device } from '@/services/types';
import { formatDateTime } from '@/utils/format';
import { CameraOutlined, DownloadOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import {
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Image,
  Modal,
  Result,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import html2canvas from 'html2canvas';
import { useRef, useState } from 'react';

/** 取最近一条严重告警及其设备详情，作为被截图的业务卡片；指定设备时取该设备最近的告警 */
const loadCard = async (deviceId?: string) => {
  if (deviceId) {
    const device = await getDevice(deviceId);
    const alarm =
      device.recentAlarms.find((item) => item.level === 'critical') ??
      device.recentAlarms[0] ??
      (await listAlarms({ deviceId, pageSize: 1 })).list[0];
    return { alarm, device };
  }
  const { list } = await listAlarms({ level: 'critical', pageSize: 1 });
  const alarm = list[0] ?? (await listAlarms({ pageSize: 1 })).list[0];
  // 全库无告警时不再解引用 alarm.deviceId（此前在 useApi 里抛错，页面卡死在骨架屏）
  if (!alarm) return { alarm: undefined, device: undefined };
  const device = await getDevice(alarm.deviceId);
  return { alarm, device };
};

export default function Screenshot() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const chart = useChartTheme();
  const captureRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<string>();
  const [busy, setBusy] = useState(false);
  // 截图对象可选（E07：主线演示时选「演示 · 主线故障站」）；默认继承最近严重告警的设备
  const [deviceId, setDeviceId] = useState<string>();
  const { data: devices } = useApi(() => listAllDevices().then((list) => list.slice(0, 300)));
  const { data, loading, error, reload } = useApi(() => loadCard(deviceId), [deviceId]);
  const deviceOptions = (devices ?? []).map((device: Device) => ({
    value: device.id,
    label: `${device.name} · ${device.id}`,
  }));

  /** html2canvas 渲染 DOM：背景取当前主题色，按设备像素比输出清晰图片 */
  const capture = async () => {
    if (!captureRef.current) return undefined;
    setBusy(true);
    try {
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: chart.background,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
      });
      return canvas.toDataURL('image/png');
    } catch {
      message.error(t('screenshot.failed'));
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    const url = await capture();
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data?.alarm?.id ?? 'screenshot'}.png`;
    link.click();
  };

  const recent = data?.device?.recentAlarms ?? [];

  return (
    <DemoPage
      descriptionId="page.screenshot.desc"
      source="src/pages/Components/Screenshot/index.tsx"
      extra={
        <Space>
          <Select
            className="min-w-56"
            showSearch
            allowClear
            placeholder={t('screenshot.pickDevice')}
            value={deviceId}
            onChange={setDeviceId}
            options={deviceOptions}
            optionFilterProp="label"
            data-tour="screenshot-device"
          />
          <Button icon={<CameraOutlined />} loading={busy} onClick={async () => setImage(await capture())}>
            {t('screenshot.capture')}
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} loading={busy} onClick={download}>
            {t('screenshot.download')}
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary">{t('screenshot.hint')}</Typography.Paragraph>
      {/* 虚线框用 colorBorder（colorBorderSecondary 在浅色背景上几乎看不见） */}
      <div className="max-w-3xl rounded-lg border border-dashed p-4" style={{ borderColor: chart.token.colorBorder }}>
        <div ref={captureRef} className="p-2">
          <Card
            title={t('screenshot.cardTitle')}
            extra={
              data?.alarm && (
                <Tag color={LEVEL_COLOR[data.alarm.level]}>
                  {intl.formatMessage({ id: `alarmLevel.${data.alarm.level}` })}
                </Tag>
              )
            }
          >
            {/* 失败态优先于「无告警」空态：否则拉取失败会被误读成没有告警（骨架在 error 时也不再无限转） */}
            <Skeleton active loading={loading && !error}>
              {error ? (
                <Result
                  status="warning"
                  title={t('common.loadFailed')}
                  extra={
                    <Button onClick={reload} loading={loading}>
                      {t('common.retry')}
                    </Button>
                  }
                />
              ) : data?.alarm ? (
                <>
                  {/* 类型是主信息（大号），告警编号是辅助信息（小号灰字），不再与标题、级别标签挤在卡片头 */}
                  <Typography.Title level={4} className="!mb-1 !mt-0">
                    {intl.formatMessage({ id: `alarmType.${data.alarm.type}` })}
                  </Typography.Title>
                  <Typography.Text type="secondary" className="mb-4 block text-xs">
                    {data.alarm.id}
                  </Typography.Text>
                  {/* 响应式列数要写全各断点：只写 xs / sm 时，更宽的断点会回落到默认 3 列 */}
                  <Descriptions column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }} size="small">
                    <Descriptions.Item label={t('screenshot.device')}>{data.device.name}</Descriptions.Item>
                    <Descriptions.Item label={t('screenshot.location')}>
                      {intl.formatMessage({ id: `region.${data.device.region}` })} · {data.device.city}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('screenshot.model')}>
                      {data.device.model} · {data.device.band[0]}–{data.device.band[1]} MHz
                    </Descriptions.Item>
                    <Descriptions.Item label={t('screenshot.occurredAt')}>
                      {formatDateTime(data.alarm.occurredAt, 'YYYY-MM-DD HH:mm:ss')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('screenshot.status')}>
                      {intl.formatMessage({ id: `alarmStatus.${data.alarm.status}` })}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('screenshot.source')}>
                      {intl.formatMessage({ id: `alarmSource.${data.alarm.source}` })}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('screenshot.uptime')}>{data.device.uptime30d}%</Descriptions.Item>
                    <Descriptions.Item label={t('screenshot.signal')}>{data.device.signalDbm} dBm</Descriptions.Item>
                  </Descriptions>
                  <Typography.Text type="secondary" className="mt-4 mb-2 block text-xs">
                    {t('screenshot.recentAlarms')}
                  </Typography.Text>
                  {/* 逐条列出（级别标签 + 类型 + 时间 · 状态）：此前是「柱高 = 级别」的迷你柱图，
                      设备只有一条告警时画成一整块红色矩形，也读不出是哪种告警 */}
                  {recent.length ? (
                    <div className="flex flex-col gap-1.5">
                      {recent.slice(0, 5).map((alarm) => (
                        <div key={alarm.id} className="flex items-center gap-2 text-xs">
                          <SemanticTag tone={LEVEL_COLOR[alarm.level]} className="m-0">
                            {intl.formatMessage({ id: `alarmLevel.${alarm.level}` })}
                          </SemanticTag>
                          <span>{intl.formatMessage({ id: `alarmType.${alarm.type}` })}</span>
                          <Typography.Text type="secondary" className="ml-auto text-xs tabular-nums">
                            {formatDateTime(alarm.occurredAt, 'MM-DD HH:mm')} ·{' '}
                            {intl.formatMessage({ id: `alarmStatus.${alarm.status}` })}
                          </Typography.Text>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Typography.Text type="secondary" className="text-xs">
                      {t('devices.noAlarms')}
                    </Typography.Text>
                  )}
                </>
              ) : (
                !loading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('devices.noAlarms')} />
              )}
            </Skeleton>
          </Card>
        </div>
      </div>
      <Modal
        open={!!image}
        title={t('screenshot.previewTitle')}
        footer={null}
        width={720}
        onCancel={() => setImage(undefined)}
        destroyOnHidden
      >
        {image && <Image src={image} alt={t('screenshot.previewTitle')} preview={false} />}
      </Modal>
    </DemoPage>
  );
}
