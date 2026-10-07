import DemoPage from '@/components/DemoPage';
import { useApi } from '@/hooks/useApi';
import { listAllDevices } from '@/services/ops';
import { useIntl } from '@umijs/max';
import { Card, Progress, Skeleton, Table, Tag } from 'antd';
import { useMemo } from 'react';
import { KEY_BANDS, coverageByModel, devicesCovering } from './bands';
import CoverageChart from './CoverageChart';

export default function Spectrum() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { data: devices, loading } = useApi(listAllDevices);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devices, intl],
  );

  return (
    <DemoPage descriptionId="page.spectrum.desc" source="src/pages/Ops/Spectrum/CoverageChart.tsx">
      <Card title={t('spectrum.coverage')} className="mb-4">
        <Skeleton active loading={loading && !devices}>
          <CoverageChart models={models} />
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
