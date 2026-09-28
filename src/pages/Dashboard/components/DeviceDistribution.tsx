import { useChartTheme } from '@/hooks/useChartTheme';
import type { DashboardOverview } from '@/services/types';
import { Sunburst } from '@ant-design/plots';
import { useIntl } from '@umijs/max';

/** 设备分布：大区 → 城市（点击扇区下钻） */
export default function DeviceDistribution({
  data,
  height,
}: {
  data: DashboardOverview['regionTree'];
  height: number;
}) {
  const intl = useIntl();
  const chart = useChartTheme();
  const tree = {
    name: intl.formatMessage({ id: 'dashboard.distribution.root' }),
    children: data.map((region) => ({
      name: intl.formatMessage({ id: `region.${region.region}` }),
      children: region.cities.map((city) => ({ name: city.city, value: city.count })),
    })),
  };

  return (
    <Sunburst
      // 层级数据是单个根对象，需以 inline 数据声明传入（直接传对象会被当作数据配置解析）
      data={{ value: tree }}
      valueField="value"
      height={height}
      theme={chart.g2Theme}
      innerRadius={0.2}
      legend={false}
      scale={{ color: { range: chart.categories } }}
      label={{ text: 'name', transform: [{ type: 'overflowHide' }], fill: '#fff', fontSize: 11 }}
      interaction={{
        drillDown: {
          breadCrumb: {
            rootText: intl.formatMessage({ id: 'dashboard.distribution.root' }),
            style: { fontSize: 12, fill: chart.textSecondary },
            active: { fill: chart.color('blue') },
          },
        },
      }}
      state={{ active: { zIndex: 2, stroke: chart.background, lineWidth: 2 } }}
      style={{ stroke: chart.background, lineWidth: 1 }}
    />
  );
}
