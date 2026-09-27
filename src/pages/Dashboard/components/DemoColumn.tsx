import { Column } from '@ant-design/plots';
import { Button, Result, Spin } from 'antd';
import { useChartData } from './useChartData';

type ColumnDatum = {
  state: string;
  age: string;
  population: number;
};

const DemoColumn = () => {
  // 数据本地化（public/data/charts，由 scripts/generate-chart-data.mjs 生成），加载/错误态可见可重试
  const { data, loading, error, retry } = useChartData<ColumnDatum[]>(`${PUBLIC_PATH}data/charts/column-stacked.json`);

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
    <Column
      data={data}
      xField="state"
      yField="population"
      colorField="age"
      stack
      sort={{ reverse: true, by: 'y' }}
      axis={{
        y: { labelFormatter: '~s' },
        x: { labelSpacing: 4, style: { labelTransform: 'rotate(90)' } },
      }}
    />
  );
};

export default DemoColumn;
