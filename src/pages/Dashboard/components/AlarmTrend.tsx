import { useChartTheme } from '@/hooks/useChartTheme';
import type { AlarmLevel, DashboardOverview } from '@/services/types';
import { Column } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import dayjs from 'dayjs';

const LEVELS: AlarmLevel[] = ['critical', 'major', 'minor', 'info'];

/** 近 N 天每日告警数，按级别堆叠；级别颜色与全站语义色一致 */
export default function AlarmTrend({
  data,
  days,
  height,
}: {
  data: DashboardOverview['alarmTrend'];
  days: number;
  height: number;
}) {
  const intl = useIntl();
  const chart = useChartTheme();
  const label = (level: AlarmLevel) => intl.formatMessage({ id: `alarmLevel.${level}` });
  const dates = [...new Set(data.map((row) => row.date))].slice(-days);
  const since = dates[0];
  const rows = data.filter((row) => row.date >= since).map((row) => ({ ...row, levelLabel: label(row.level) }));

  return (
    <Column
      data={rows}
      xField="date"
      yField="count"
      colorField="levelLabel"
      stack
      height={height}
      theme={chart.g2Theme}
      scale={{
        color: { domain: LEVELS.map(label), range: LEVELS.map(chart.levelColor) },
      }}
      axis={{
        x: {
          title: false,
          labelFormatter: (value: string) => dayjs(value).format('MM-DD'),
          labelAutoRotate: false,
          labelAutoHide: true,
        },
        y: { title: false },
      }}
      legend={{ color: { position: 'top', layout: { justifyContent: 'flex-end' } } }}
      interaction={{ tooltip: { shared: true } }}
    />
  );
}
