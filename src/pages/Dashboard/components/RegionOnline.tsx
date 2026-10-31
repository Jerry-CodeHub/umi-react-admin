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
      // total 为 0 的大区此前会算出 NaN%（NaN 还会污染按 rate 的排序）：按 0 处理
      rate: row.total ? Math.round((row.online / row.total) * 1000) / 10 : 0,
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
        // 深色字：白字压在亮绿柱上只有 2.3:1，近黑字两套主题下都在 7:1 以上
        fill: 'rgba(0, 0, 0, 0.88)',
      }}
      tooltip={{ items: [{ field: 'detail', name: ' ' }] }}
    />
  );
}
