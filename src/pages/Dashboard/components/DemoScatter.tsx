import { Scatter } from '@ant-design/plots';
import { Button, Result, Spin } from 'antd';
import { useChartData } from './useChartData';

type ScatterDatum = {
  date: string | number | Date;
  value: number;
};

const DemoScatter = () => {
  // 数据本地化（public/data/charts），加载/错误态可见可重试
  const { data, loading, error, retry } = useChartData<ScatterDatum[]>(`${PUBLIC_PATH}data/charts/scatter-point.json`);

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
    <Scatter
      data={data}
      paddingLeft={60}
      xField={(d: ScatterDatum) => new Date(d.date)}
      yField="value"
      colorField="value"
      shapeField="point"
      style={{
        stroke: '#000',
        strokeOpacity: 0.2,
      }}
      scale={{
        color: {
          palette: 'rdBu',
          offset: (t: number) => 1 - t,
        },
      }}
      tooltip={[
        {
          channel: 'x',
          name: 'year',
          valueFormatter: (d: Date) => d.getFullYear(),
        },
        { channel: 'y' },
      ]}
      annotations={[
        {
          type: 'lineY',
          data: [0],
          style: { stroke: '#000', strokeOpacity: 0.2 },
        },
      ]}
    />
  );
};

export default DemoScatter;
