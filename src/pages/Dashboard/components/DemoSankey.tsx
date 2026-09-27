import { Sankey } from '@ant-design/plots';

const DemoSankey = () => {
  const config = {
    data: [
      { source: '访问', target: '表格', value: 18 },
      { source: '访问', target: 'D3', value: 10 },
      { source: '访问', target: '地图', value: 16 },
      { source: '表格', target: '办公', value: 6 },
      { source: 'D3', target: '留存', value: 7 },
      { source: '地图', target: '留存', value: 12 },
    ],
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

  return <Sankey {...config} />;
};

export default DemoSankey;
