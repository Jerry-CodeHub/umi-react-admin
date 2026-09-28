import { useChartTheme } from '@/hooks/useChartTheme';
import type { DashboardOverview } from '@/services/types';
import { formatNumber } from '@/utils/format';
import { Pie } from '@ant-design/plots';
import { useIntl } from '@umijs/max';

/** 近 30 天告警类型占比（环图，中心显示总数） */
export default function AlarmTypes({ data, height }: { data: DashboardOverview['alarmTypes']; height: number }) {
  const intl = useIntl();
  const chart = useChartTheme();
  const rows = [...data]
    .sort((a, b) => b.count - a.count)
    .map((row) => ({ ...row, typeLabel: intl.formatMessage({ id: `alarmType.${row.type}` }) }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <Pie
      data={rows}
      angleField="count"
      colorField="typeLabel"
      innerRadius={0.64}
      height={height}
      theme={chart.g2Theme}
      scale={{ color: { range: chart.categories } }}
      label={false}
      legend={{ color: { position: 'right', rowPadding: 6 } }}
      tooltip={{ items: [{ field: 'count', name: intl.formatMessage({ id: 'dashboard.types.total' }) }] }}
      annotations={[
        {
          type: 'text',
          style: {
            text: formatNumber(total, intl.locale),
            x: '50%',
            y: '46%',
            textAlign: 'center',
            fontSize: 26,
            fontWeight: 600,
            fill: chart.text,
          },
        },
        {
          type: 'text',
          style: {
            text: intl.formatMessage({ id: 'dashboard.types.total' }),
            x: '50%',
            y: '57%',
            textAlign: 'center',
            fontSize: 12,
            fill: chart.textSecondary,
          },
        },
      ]}
    />
  );
}
