import { Sunburst } from '@ant-design/plots';
import { useEffect, useState } from 'react';

const DemoSunburst = () => {
  const [config, setConfig] = useState({});

  useEffect(() => {
    const config = {
      data: {
        type: 'fetch',
        value: 'https://gw.alipayobjects.com/os/antvdemo/assets/data/sunburst.json',
      },
      valueField: 'sum',
      label: {
        text: 'name',
        transform: [
          {
            type: 'overflowHide',
          },
        ],
      },
      interaction: {
        drillDown: {
          breadCrumb: {
            rootText: '起始',
            style: {
              fontSize: '18px',
              fill: '#333',
            },
            active: {
              fill: 'red',
            },
          },
          // FixedColor default: true, true -> drillDown update scale, false -> scale keep.
          fixedColor: false,
        },
      },
      state: {
        active: { zIndex: 2, stroke: 'red' },
        inactive: { zIndex: 1, stroke: '#fff' },
      },
    };
    setConfig(config);
  }, []);

  return <Sunburst {...config} />;
};

// ReactDOM.render(<DemoSunburst />, document.getElementById('container'));

export default DemoSunburst;
