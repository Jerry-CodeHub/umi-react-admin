import { useChartTheme } from '@/hooks/useChartTheme';
import type { DashboardOverview } from '@/services/types';
import { formatNumber, formatPercent } from '@/utils/format';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Tiny } from '@ant-design/plots';
import { Link, useIntl } from '@umijs/max';
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
  /** 点击进入对应明细页（E02：从概览直接进入对象，指标与列表数量一致） */
  to?: string;
};

const KpiCard = ({ title, hint, value, footer, chart, loading, to }: KpiCardProps) => (
  <Card
    className={to ? 'h-full transition-shadow hover:shadow-md' : 'h-full'}
    styles={{ body: { padding: '20px 24px 16px' } }}
  >
    <Skeleton active loading={loading} paragraph={{ rows: 2 }}>
      <Link to={to ?? '#'} className="block text-inherit" aria-label={title}>
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
      </Link>
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
      {/* opacity-60 把这行压到 4.41:1（白底 16px）：改用说明文字 token（浅色 6.39:1 / 暗色 7.57:1） */}
      {suffix && <span className="ml-1 text-base font-normal text-text-tertiary">{suffix}</span>}
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
      to: '/ops/devices',
      footer: kpi && (
        <div>
          <Progress
            percent={Math.round(onlineRate * 1000) / 10}
            showInfo={false}
            strokeColor={chart.color('green')}
            size="small"
            /* role="progressbar" 没有可见名称（axe aria-progressbar-name）：用卡片标题作为名称 */
            aria-label={t('dashboard.kpi.onlineRate', { rate: formatPercent(onlineRate, locale) })}
          />
          <span style={{ color: chart.textSecondary }}>
            {t('dashboard.kpi.onlineRate', { rate: formatPercent(onlineRate, locale) })}
          </span>
        </div>
      ),
      loading,
    },
    {
      to: '/ops/alarms',
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
          // 暗色卡片底上 25% 的蓝几乎看不见，提到 45%
          style={{ fill: chart.color('blue'), fillOpacity: chart.dark ? 0.45 : 0.25, stroke: chart.color('blue') }}
          tooltip={false}
        />
      ),
      footer: kpi && (
        <Delta
          value={alarmDiff}
          // 昨日同期为 0 时比率无定义（此前回落成 0.0% 却配上升箭头）：改示绝对增量
          text={
            kpi.alarmsYesterdaySamePeriod
              ? formatPercent(Math.abs(alarmDiffRatio), locale, 0)
              : formatNumber(Math.abs(alarmDiff), locale)
          }
          higherIsBetter={false}
          label={t('dashboard.kpi.vsYesterday')}
        />
      ),
      loading,
    },
    {
      to: '/ops/tickets',
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
      to: '/ops/tickets',
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
