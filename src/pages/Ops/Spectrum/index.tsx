import DemoPage from '@/components/DemoPage';
import { useApi } from '@/hooks/useApi';
import { listAllDevices } from '@/services/ops';
import { useIntl } from '@umijs/max';
import { Button, Card, Grid, Progress, Result, Skeleton, Table, Tag, Typography } from 'antd';
import { useCallback, useMemo } from 'react';
import { KEY_BANDS, coverageByModel, devicesCovering } from './bands';
import CoverageChart, { formatMHz } from './CoverageChart';

export default function Spectrum() {
  const intl = useIntl();
  // useCallback 包一层：rows 的 useMemo 依赖它，行内函数每次渲染都是新引用会让 memo 失效
  const t = useCallback(
    (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values),
    [intl],
  );
  const { data: devices, loading, error, reload } = useApi(listAllDevices);
  const { md } = Grid.useBreakpoint();

  const models = useMemo(() => coverageByModel(devices ?? []), [devices]);
  const online = devices?.filter((d) => d.status === 'online').length ?? 0;
  const rows = useMemo(
    () =>
      KEY_BANDS.map((band) => {
        const covering = devicesCovering(devices ?? [], band.range);
        return {
          key: band.key,
          name: t(`spectrum.band.${band.key}`),
          range: band.range,
          count: covering.length,
          models: [...new Set(covering.map((d) => d.model))].sort(),
        };
      }),
    [devices, t],
  );

  // 窄屏摘要（审计 U03）：图 minimum 720px 宽、只能横滚，先把整体频段范围说清楚
  const monitoredRange = models.length
    ? `${formatMHz(Math.min(...models.map((m) => m.band[0])))} – ${formatMHz(Math.max(...models.map((m) => m.band[1])))}`
    : undefined;

  return (
    <DemoPage descriptionId="page.spectrum.desc" source="src/pages/Ops/Spectrum/CoverageChart.tsx">
      <Card title={t('spectrum.coverage')} className="mb-4">
        {!md && monitoredRange && (
          <Typography.Text type="secondary" className="block text-xs">
            {t('spectrum.rangeSummary', { range: monitoredRange, bands: KEY_BANDS.length })} ·{' '}
            {t('spectrum.scrollHint')}
          </Typography.Text>
        )}
        <Skeleton active loading={loading && !devices}>
          {error ? (
            // 拉取失败不再渲染成「零覆盖」图表与 0/0 表格：给出失败态与重试
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
            <CoverageChart models={models} />
          )}
        </Skeleton>
      </Card>
      <Card title={t('spectrum.keyBands')}>
        <Table
          size="middle"
          pagination={false}
          loading={loading && !devices}
          dataSource={rows}
          scroll={{ x: 640 }}
          columns={[
            { title: t('spectrum.column.band'), dataIndex: 'name' },
            {
              title: t('spectrum.column.range'),
              dataIndex: 'range',
              render: (range: [number, number]) => `${range[0]}–${range[1]} MHz`,
            },
            {
              title: t('spectrum.column.devices'),
              dataIndex: 'count',
              width: 280,
              render: (count: number) => (
                <Progress
                  percent={online ? Math.round((count / online) * 100) : 0}
                  format={() => `${count} / ${online}`}
                  size="small"
                />
              ),
            },
            {
              title: t('spectrum.column.models'),
              dataIndex: 'models',
              render: (list: string[]) => list.map((model) => <Tag key={model}>{model}</Tag>),
            },
          ]}
        />
      </Card>
    </DemoPage>
  );
}
