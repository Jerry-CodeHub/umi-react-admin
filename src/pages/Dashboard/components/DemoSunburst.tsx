import { Sunburst } from '@ant-design/plots';
import { Button, Result, Spin } from 'antd';
import { useChartData } from './useChartData';

type SunburstNode = {
  name: string;
  sum?: number;
  children?: SunburstNode[];
};

const DemoSunburst = () => {
  // 数据本地化（public/data/charts，由 scripts/generate-chart-data.mjs 生成），加载/错误态可见可重试
  const { data, loading, error, retry } = useChartData<SunburstNode>(`${PUBLIC_PATH}data/charts/sunburst.json`);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Spin />
      </div>
    );
  }
  if (error || !data) {
    return <Result status="warning" title="数据加载失败" extra={<Button onClick={retry}>重试</Button>} />;
  }

  return (
    <Sunburst
      // 层级数据是单个根对象，需以 inline 数据声明传入（直接传对象会被当作数据配置解析）
      data={{ value: data }}
      valueField="sum"
      label={{ text: 'name', transform: [{ type: 'overflowHide' }] }}
      interaction={{
        drillDown: {
          breadCrumb: {
            rootText: '起始',
            style: { fontSize: '18px', fill: '#333' },
            active: { fill: 'red' },
          },
          // FixedColor default: true, true -> drillDown update scale, false -> scale keep.
          fixedColor: false,
        },
      }}
      state={{
        active: { zIndex: 2, stroke: 'red' },
        inactive: { zIndex: 1, stroke: '#fff' },
      }}
    />
  );
};

export default DemoSunburst;
