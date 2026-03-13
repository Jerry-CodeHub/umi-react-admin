import { Line } from '@ant-design/plots';
import { format } from 'fecha';
import { useEffect, useState } from 'react';

const DemoLine = () => {
  const [config, setConfig] = useState({});

  useEffect(() => {
    const config = {
      data: {
        type: 'fetch',
        value: 'https://render.alipay.com/p/yuyan/180020010001215413/antd-charts/line-slider.json',
      },
      xField: (d: any) => new Date(d.date),
      yField: 'close',
      axis: { x: { title: false, size: 40 }, y: { title: false, size: 36 } },
      slider: {
        x: { labelFormatter: (d: any) => format(d, 'YYYY/M/D') },
        y: { labelFormatter: '~s' },
      },
    };

    setConfig(config);
  }, []);

  return <Line {...config} />;
};

// ReactDOM.render(<DemoLine />, document.getElementById('container'));
export default DemoLine;
