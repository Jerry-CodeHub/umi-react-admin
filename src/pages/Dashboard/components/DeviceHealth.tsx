import { useChartTheme } from '@/hooks/useChartTheme';
import type { DashboardOverview } from '@/services/types';
import { Scatter } from '@ant-design/plots';
import { useIntl } from '@umijs/max';

/** 设备健康：近 30 天在线率 × 告警数，每个点是一台设备，按大区着色 */
export default function DeviceHealth({ data, height }: { data: DashboardOverview['deviceHealth']; height: number }) {
  const intl = useIntl();
  const chart = useChartTheme();
  const rows = data.map((row) => ({ ...row, regionLabel: intl.formatMessage({ id: `region.${row.region}` }) }));

  return (
    <Scatter
      data={rows}
      xField="uptime30d"
      yField="alarms30d"
      colorField="regionLabel"
      shapeField="point"
      sizeField={4}
      height={height}
      theme={chart.g2Theme}
      scale={{ color: { range: chart.categories }, x: { nice: true }, size: { range: [4, 4] } }}
      style={{ fillOpacity: 0.75, lineWidth: 0 }}
      axis={{
        x: { title: intl.formatMessage({ id: 'dashboard.health.x' }), titleFill: chart.textSecondary },
        y: { title: intl.formatMessage({ id: 'dashboard.health.y' }), titleFill: chart.textSecondary },
      }}
      legend={{ color: { position: 'top', layout: { justifyContent: 'flex-end' } } }}
      tooltip={{ title: 'name', items: ['uptime30d', 'alarms30d'] }}
    />
  );
}
