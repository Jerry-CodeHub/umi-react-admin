import ChartCard from '@/components/ChartCard';
import DemoPage from '@/components/DemoPage';
import { useApi } from '@/hooks/useApi';
import { getDashboardOverview } from '@/services/ops';
import { formatDateTime } from '@/utils/format';
import { QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Button, Col, Row, Segmented, Tooltip, Typography } from 'antd';
import { useEffect, useState } from 'react';
import Activities from './components/Activities';
import AlarmTrend from './components/AlarmTrend';
import AlarmTypes from './components/AlarmTypes';
import DeviceDistribution from './components/DeviceDistribution';
import DeviceHealth from './components/DeviceHealth';
import Disposition from './components/Disposition';
import KpiCards from './components/KpiCards';
import RegionOnline from './components/RegionOnline';

/** 每分钟自动刷新一次：今日告警、看板状态都随时间推进 */
const REFRESH_MS = 60_000;

export default function Dashboard() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const { data, loading, error, reload } = useApi(getDashboardOverview);
  const [days, setDays] = useState(30);
  // 首次加载用骨架；之后的定时刷新保留旧数据，不闪烁
  const initialLoading = loading && !data;

  useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const card = (title: string, height: number, render: () => React.ReactNode, extra?: React.ReactNode) => (
    <ChartCard
      title={title}
      extra={extra}
      height={height}
      loading={initialLoading}
      error={!data && error}
      onRetry={reload}
    >
      {data && render()}
    </ChartCard>
  );

  return (
    <DemoPage
      descriptionId="page.dashboard.desc"
      source="src/pages/Dashboard/index.tsx"
      extra={
        data && (
          <Tooltip title={t('common.refresh')}>
            <Button icon={<ReloadOutlined spin={loading} />} onClick={reload}>
              <Typography.Text type="secondary" className="hidden md:inline">
                {t('dashboard.updatedAt', { time: formatDateTime(data.generatedAt, 'HH:mm:ss') })}
              </Typography.Text>
            </Button>
          </Tooltip>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <KpiCards kpi={data?.kpi} loading={initialLoading} />
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={16}>
            {card(
              t('dashboard.trend.title'),
              320,
              () => (
                <AlarmTrend data={data!.alarmTrend} days={days} height={320} />
              ),
              <Segmented
                size="small"
                value={days}
                onChange={(value) => setDays(value as number)}
                options={[30, 90].map((value) => ({ value, label: t('dashboard.trend.days', { days: value }) }))}
              />,
            )}
          </Col>
          <Col xs={24} md={12} xl={8}>
            {card(t('dashboard.types.title'), 320, () => (
              <AlarmTypes data={data!.alarmTypes} height={320} />
            ))}
          </Col>
          <Col xs={24} md={12} xl={8}>
            {card(t('dashboard.regions.title'), 320, () => (
              <RegionOnline data={data!.regionOnline} height={320} />
            ))}
          </Col>
          <Col xs={24} xl={16}>
            {card(t('dashboard.disposition.title'), 320, () => (
              <Disposition data={data!.disposition} height={320} />
            ))}
          </Col>
          <Col xs={24} xl={12}>
            {card(
              t('dashboard.health.title'),
              340,
              () => (
                <DeviceHealth data={data!.deviceHealth} height={340} />
              ),
              <Tooltip title={t('dashboard.health.hint')}>
                <QuestionCircleOutlined className="cursor-help opacity-60" aria-label={t('dashboard.health.hint')} />
              </Tooltip>,
            )}
          </Col>
          <Col xs={24} md={12} xl={6}>
            {card(t('dashboard.distribution.title'), 340, () => (
              <DeviceDistribution data={data!.regionTree} height={340} />
            ))}
          </Col>
          <Col xs={24} md={12} xl={6}>
            <ChartCard
              title={t('dashboard.activity.title')}
              height={340}
              loading={initialLoading}
              error={!data && error}
              onRetry={reload}
            >
              {data && (
                <div className="h-full overflow-y-auto pr-1">
                  <Activities data={data.activities} />
                </div>
              )}
            </ChartCard>
          </Col>
        </Row>
      </div>
    </DemoPage>
  );
}
