import { Column } from '@ant-design/plots';
import { useEffect, useState } from 'react';

const DemoColumn = () => {
  const [config, setConfig] = useState({});

  useEffect(() => {
    const config = {
      data: {
        type: 'fetch',
        value: 'https://render.alipay.com/p/yuyan/180020010001215413/antd-charts/column-stacked.json',
      },
      xField: 'state',
      yField: 'population',
      colorField: 'age',
      stack: true,
      sort: {
        reverse: true,
        by: 'y',
      },
      axis: {
        y: { labelFormatter: '~s' },
        x: {
          labelSpacing: 4,
          style: {
            labelTransform: 'rotate(90)',
          },
        },
      },
    };
    setConfig(config);
  }, []);

  return <Column {...config} />;
};

// ReactDOM.render(<DemoColumn />, document.getElementById('container'));

export default DemoColumn;
