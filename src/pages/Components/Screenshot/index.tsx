import DemoPage from '@/components/DemoPage';
import { ALARM_LEVEL_KEYS } from '@/constants/enums';
import { LEVEL_COLOR } from '@/constants/semantic';
import { useApi } from '@/hooks/useApi';
import { useChartTheme } from '@/hooks/useChartTheme';
import { getDevice, listAlarms } from '@/services/ops';
import { formatDateTime } from '@/utils/format';
import { CameraOutlined, DownloadOutlined } from '@ant-design/icons';
import { Tiny } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { App, Button, Card, Descriptions, Image, Modal, Skeleton, Space, Tag, Typography } from 'antd';
import html2canvas from 'html2canvas';
import { useRef, useState } from 'react';

/** 取最近一条严重告警及其设备详情，作为被截图的业务卡片 */
const loadCard = async () => {
  const { list } = await listAlarms({ level: 'critical', pageSize: 1 });
  const alarm = list[0] ?? (await listAlarms({ pageSize: 1 })).list[0];
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
  const { data, loading } = useApi(loadCard);

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
    link.download = `${data?.alarm.id ?? 'screenshot'}.png`;
    link.click();
  };

  const recent = data?.device.recentAlarms ?? [];

  return (
    <DemoPage
      descriptionId="page.screenshot.desc"
      source="src/pages/Components/Screenshot/index.tsx"
      extra={
        <Space>
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
              data && (
                <Tag color={LEVEL_COLOR[data.alarm.level]}>
                  {intl.formatMessage({ id: `alarmLevel.${data.alarm.level}` })}
                </Tag>
              )
            }
          >
            <Skeleton active loading={loading || !data}>
              {data && (
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
                  <Typography.Text type="secondary" className="mt-4 block text-xs">
                    {t('screenshot.recentAlarms')}
                  </Typography.Text>
                  <Tiny.Column
                    data={[...recent].reverse().map((alarm, index) => ({
                      index,
                      value: { critical: 4, major: 3, minor: 2, info: 1 }[alarm.level],
                      level: alarm.level,
                    }))}
                    xField="index"
                    yField="value"
                    colorField="level"
                    height={60}
                    autoFit
                    theme={chart.g2Theme}
                    scale={{
                      color: {
                        domain: ALARM_LEVEL_KEYS,
                        range: ALARM_LEVEL_KEYS.map(chart.levelColor),
                      },
                    }}
                    tooltip={false}
                  />
                </>
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
