import { useChartTheme } from '@/hooks/useChartTheme';
import type { DashboardOverview } from '@/services/types';
import { Bar } from '@ant-design/plots';
import { useIntl } from '@umijs/max';

/** 各大区设备在线率（条形图从 0 起，差异如实呈现） */
export default function RegionOnline({ data, height }: { data: DashboardOverview['regionOnline']; height: number }) {
  const intl = useIntl();
  const chart = useChartTheme();
  const rows = data
    .map((row) => ({
      region: intl.formatMessage({ id: `region.${row.region}` }),
      rate: Math.round((row.online / row.total) * 1000) / 10,
      detail: intl.formatMessage({ id: 'dashboard.regions.online' }, { online: row.online, total: row.total }),
    }))
    .sort((a, b) => b.rate - a.rate);

  return (
    <Bar
      data={rows}
      xField="region"
      yField="rate"
      height={height}
      theme={chart.g2Theme}
      scale={{ y: { domain: [0, 100] } }}
      style={{ fill: chart.color('green'), maxWidth: 18, radiusTopRight: 3, radiusBottomRight: 3 }}
      axis={{ x: { title: false }, y: { title: false, labelFormatter: (v: number) => `${v}%` } }}
      label={{
        text: (d: { rate: number }) => `${d.rate}%`,
        position: 'inside',
        textAlign: 'right',
        dx: -8,
        fill: '#fff',
      }}
      tooltip={{ items: [{ field: 'detail', name: ' ' }] }}
    />
  );
}
