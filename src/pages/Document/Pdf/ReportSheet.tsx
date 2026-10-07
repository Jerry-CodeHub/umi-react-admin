import { ChartThemeOverride } from '@/hooks/useChartTheme';
import AlarmTrend from '@/pages/Dashboard/components/AlarmTrend';
import AlarmTypes from '@/pages/Dashboard/components/AlarmTypes';
import RegionOnline from '@/pages/Dashboard/components/RegionOnline';
import type { DashboardOverview } from '@/services/types';
import { formatDateTime, formatPercent } from '@/utils/format';
import { useIntl } from '@umijs/max';
import { ConfigProvider, Table, theme } from 'antd';
import { forwardRef, type ReactNode } from 'react';

/** A4 纵向在 96dpi 下的像素尺寸 */
export const SHEET = { width: 794, height: 1123 };

/** 纸面固定配色（报告始终按浅色打印，不随应用主题） */
const PAPER = { text: '#1f1f1f', muted: '#8c8c8c', line: '#f0f0f0', accent: '#1677ff', tile: '#f5f7fa' };

const Sheet = ({ children, page, total }: { children: ReactNode; page: number; total: number }) => {
  const intl = useIntl();
  return (
    <div
      className="report-sheet relative flex flex-col bg-white px-14 py-12"
      style={{ width: SHEET.width, height: SHEET.height, color: PAPER.text }}
    >
      <div className="flex-1">{children}</div>
      <div
        className="flex justify-between border-t border-solid pt-3 text-[11px]"
        style={{ borderColor: PAPER.line, color: PAPER.muted }}
      >
        <span>{intl.formatMessage({ id: 'pdf.report.disclaimer' })}</span>
        <span>{intl.formatMessage({ id: 'pdf.report.page' }, { page, total })}</span>
      </div>
    </div>
  );
};

const H = ({ children }: { children: ReactNode }) => (
  <h3
    className="mt-6 mb-3 border-l-4 border-solid pl-2 text-[15px] font-semibold"
    style={{ borderColor: PAPER.accent }}
  >
    {children}
  </h3>
);

/**
 * 月报的两页纸面（固定 A4 像素尺寸、始终浅色）。放在屏幕外渲染，由 html2canvas 截图后封装成 PDF。
 * 图表直接复用工作台组件，数字与工作台同源。
 */
const ReportSheet = forwardRef<HTMLDivElement, { overview: DashboardOverview }>(({ overview }, ref) => {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const now = new Date(overview.generatedAt);
  const { kpi } = overview;
  const topDevices = [...overview.deviceHealth].sort((a, b) => b.alarms30d - a.alarms30d).slice(0, 8);

  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      <ChartThemeOverride.Provider value="light">
        <div ref={ref} className="flex flex-col gap-4">
          <Sheet page={1} total={2}>
            <div className="text-[26px] font-semibold">{t('pdf.report.title')}</div>
            <div className="mt-1 text-[12px]" style={{ color: PAPER.muted }}>
              {t('pdf.report.period', {
                from: formatDateTime(now.getTime() - 29 * 86_400_000, 'YYYY-MM-DD'),
                to: formatDateTime(now, 'YYYY-MM-DD'),
              })}
              {' · '}
              {t('pdf.report.generatedAt', { time: formatDateTime(now, 'YYYY-MM-DD HH:mm') })}
            </div>
            <div className="mt-8 grid grid-cols-4 gap-3">
              {[
                [t('dashboard.kpi.devices'), `${kpi.devicesOnline} / ${kpi.devicesTotal}`],
                [t('dashboard.kpi.alarmsToday'), String(kpi.alarmsToday)],
                [t('dashboard.kpi.sla'), formatPercent(kpi.slaRate, intl.locale)],
                [t('dashboard.kpi.response'), `${kpi.avgResponseMinutes} ${t('dashboard.kpi.minutes')}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md px-4 py-3" style={{ background: PAPER.tile }}>
                  <div className="text-[12px]" style={{ color: PAPER.muted }}>
                    {label}
                  </div>
                  <div className="mt-1 text-[22px] font-semibold">{value}</div>
                </div>
              ))}
            </div>
            <H>{t('dashboard.trend.title')}</H>
            <AlarmTrend data={overview.alarmTrend} days={30} height={300} />
            <H>{t('dashboard.types.title')}</H>
            <AlarmTypes data={overview.alarmTypes} height={300} />
          </Sheet>
          <Sheet page={2} total={2}>
            <H>{t('dashboard.regions.title')}</H>
            <RegionOnline data={overview.regionOnline} height={320} />
            <H>{t('pdf.report.topDevices')}</H>
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={topDevices.map((device, index) => ({ ...device, rank: index + 1 }))}
              columns={[
                { title: t('pdf.report.rank'), dataIndex: 'rank', width: 60 },
                { title: t('devices.column.device'), dataIndex: 'name' },
                {
                  title: t('devices.column.region'),
                  dataIndex: 'region',
                  render: (region: string) => t(`region.${region}`),
                },
                { title: t('devices.column.uptime'), dataIndex: 'uptime30d', render: (v: number) => `${v}%` },
                { title: t('pdf.report.alarms'), dataIndex: 'alarms30d' },
              ]}
            />
          </Sheet>
        </div>
      </ChartThemeOverride.Provider>
    </ConfigProvider>
  );
});

export default ReportSheet;
