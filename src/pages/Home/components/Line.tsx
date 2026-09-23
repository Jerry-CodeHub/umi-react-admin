import { Line } from '@ant-design/plots';
import { Button, Result, Spin } from 'antd';
import dayjs from 'dayjs';
import { useChartData } from './useChartData';

type LineDatum = {
  date: string | number | Date;
  close: number;
};

const DemoLine = () => {
  // 数据本地化（public/data/charts），加载/错误态可见可重试
  const { data, loading, error, retry } = useChartData<LineDatum[]>(`${PUBLIC_PATH}data/charts/line-slider.json`);

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
    <Line
      data={data}
      xField={(d: LineDatum) => new Date(d.date)}
      yField="close"
      axis={{ x: { title: false, size: 40 }, y: { title: false, size: 36 } }}
      slider={{
        x: { labelFormatter: (d: Date) => dayjs(d).format('YYYY/M/D') },
        y: { labelFormatter: '~s' },
      }}
    />
  );
};

export default DemoLine;
