import { Scatter } from '@ant-design/plots';
import { useEffect, useState } from 'react';

const DemoScatter = () => {
  const [config, setConfig] = useState({});

  useEffect(() => {
    const config = {
      paddingLeft: 60,
      data: {
        type: 'fetch',
        value: 'https://render.alipay.com/p/yuyan/180020010001215413/antd-charts/scatter-point-sequential.json',
      },
      xField: (d: any) => new Date(d.date),
      yField: 'value',
      colorField: 'value',
      shapeField: 'point',
      style: {
        stroke: '#000',
        strokeOpacity: 0.2,
      },
      scale: {
        color: {
          palette: 'rdBu',
          offset: (t: any) => 1 - t,
        },
      },
      tooltip: [
        {
          channel: 'x',
          name: 'year',
          valueFormatter: (d: any) => d.getFullYear(),
        },
        { channel: 'y' },
      ],
      annotations: [
        {
          type: 'lineY',
          data: [0],
          style: { stroke: '#000', strokeOpacity: 0.2 },
        },
      ],
    };
    setConfig(config);
  }, []);

  return <Scatter {...config} />;
};

// ReactDOM.render(<DemoScatter />, document.getElementById('container'));

export default DemoScatter;
