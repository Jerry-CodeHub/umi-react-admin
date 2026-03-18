import { Sankey } from '@ant-design/plots';
import { useEffect, useState } from 'react';

const DemoSankey = () => {
  const [config, setConfig] = useState({});

  useEffect(() => {
    const config = {
      data: {
        type: 'fetch',
        value: 'https://assets.antv.antgroup.com/g2/energy.json',
      },
      scale: {
        color: {
          range: [
            '#4e79a7',
            '#f28e2c',
            '#e15759',
            '#76b7b2',
            '#59a14f',
            '#edc949',
            '#af7aa1',
            '#ff9da7',
            '#9c755f',
            '#bab0ab',
          ],
        },
      },
      layout: { nodeAlign: 'center', nodePadding: 0.03 },
      style: {
        labelSpacing: 3,
        labelFontWeight: 'bold',
        nodeStrokeWidth: 1.2,
        linkFillOpacity: 0.4,
      },
    };
    setConfig(config);
  }, []);

  return <Sankey {...config} />;
};

export default DemoSankey;
