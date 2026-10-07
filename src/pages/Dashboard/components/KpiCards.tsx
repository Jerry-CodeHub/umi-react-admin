import { useChartTheme } from '@/hooks/useChartTheme';
import type { DashboardOverview } from '@/services/types';
import { formatNumber, formatPercent } from '@/utils/format';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Tiny } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { Card, Col, Progress, Row, Skeleton, Tooltip, Typography } from 'antd';
import type { ReactNode } from 'react';
import Delta from './Delta';

type KpiCardProps = {
  title: string;
  hint?: string;
  value: ReactNode;
  footer: ReactNode;
  chart?: ReactNode;
  loading: boolean;
};

const KpiCard = ({ title, hint, value, footer, chart, loading }: KpiCardProps) => (
  <Card className="h-full" styles={{ body: { padding: '20px 24px 16px' } }}>
    <Skeleton active loading={loading} paragraph={{ rows: 2 }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Typography.Text type="secondary">
            {title}
            {hint && (
              <Tooltip title={hint}>
                <InfoCircleOutlined className="ml-1" />
              </Tooltip>
            )}
          </Typography.Text>
          <div className="mt-1">{value}</div>
        </div>
        {chart && <div className="w-28 shrink-0 pt-2">{chart}</div>}
      </div>
      <div className="mt-3 text-sm">{footer}</div>
    </Skeleton>
  </Card>
);

/** 四个核心指标：在线设备、今日告警、工单时限达成率、平均响应时长 */
export default function KpiCards({ kpi, loading }: { kpi?: DashboardOverview['kpi']; loading: boolean }) {
  const intl = useIntl();
  const chart = useChartTheme();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const locale = intl.locale;
  const pp = (diff: number) => `${formatNumber(Math.abs(diff) * 100, locale, { maximumFractionDigits: 1 })} pp`;

  const onlineRate = kpi ? kpi.devicesOnline / kpi.devicesTotal : 0;
  const alarmDiff = kpi ? kpi.alarmsToday - kpi.alarmsYesterdaySamePeriod : 0;
  const alarmDiffRatio = kpi && kpi.alarmsYesterdaySamePeriod ? alarmDiff / kpi.alarmsYesterdaySamePeriod : 0;
  const bigNumber = (text: string, suffix?: string) => (
    <span className="text-3xl font-semibold tabular-nums">
      {text}
      {suffix && <span className="ml-1 text-base font-normal opacity-60">{suffix}</span>}
    </span>
  );

  const cards: KpiCardProps[] = [
    {
      title: t('dashboard.kpi.devices'),
      value:
        kpi &&
        bigNumber(
          formatNumber(kpi.devicesOnline, locale),
          t('dashboard.kpi.devicesSuffix', { total: kpi.devicesTotal }),
        ),
      footer: kpi && (
        <div>
          <Progress
            percent={Math.round(onlineRate * 1000) / 10}
            showInfo={false}
            strokeColor={chart.color('green')}
            size="small"
          />
          <span style={{ color: chart.textSecondary }}>
            {t('dashboard.kpi.onlineRate', { rate: formatPercent(onlineRate, locale) })}
          </span>
        </div>
      ),
      loading,
    },
    {
      title: t('dashboard.kpi.alarmsToday'),
      value: kpi && bigNumber(formatNumber(kpi.alarmsToday, locale)),
      chart: kpi && (
        <Tiny.Area
          data={kpi.alarms7d.map((count, index) => ({ index, count }))}
          xField="index"
          yField="count"
          height={44}
          shapeField="smooth"
          theme={chart.g2Theme}
          style={{ fill: chart.color('blue'), fillOpacity: 0.25, stroke: chart.color('blue') }}
          tooltip={false}
        />
      ),
      footer: kpi && (
        <Delta
          value={alarmDiff}
          text={formatPercent(Math.abs(alarmDiffRatio), locale, 0)}
          higherIsBetter={false}
          label={t('dashboard.kpi.vsYesterday')}
        />
      ),
      loading,
    },
    {
      title: t('dashboard.kpi.sla'),
      hint: t('dashboard.kpi.slaHint'),
      value: kpi && bigNumber(formatPercent(kpi.slaRate, locale)),
      footer: kpi && (
        <Delta
          value={kpi.slaRate - kpi.slaRatePrev}
          text={pp(kpi.slaRate - kpi.slaRatePrev)}
          higherIsBetter
          label={t('dashboard.kpi.vsPrevious')}
        />
      ),
      loading,
    },
    {
      title: t('dashboard.kpi.response'),
      hint: t('dashboard.kpi.responseHint'),
      value: kpi && bigNumber(formatNumber(kpi.avgResponseMinutes, locale), t('dashboard.kpi.minutes')),
      footer: kpi && (
        <Delta
          value={kpi.avgResponseMinutes - kpi.avgResponseMinutesPrev}
          text={`${Math.abs(kpi.avgResponseMinutes - kpi.avgResponseMinutesPrev)} ${t('dashboard.kpi.minutes')}`}
          higherIsBetter={false}
          label={t('dashboard.kpi.vsPrevious')}
        />
      ),
      loading,
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card) => (
        <Col key={card.title} xs={24} sm={12} xl={6}>
          <KpiCard {...card} />
        </Col>
      ))}
    </Row>
  );
}
