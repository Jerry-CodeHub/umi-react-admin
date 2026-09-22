import DemoColumn from '@/pages/Home/components/DemoColumn';
import { getMessage } from '@/utils/antdMessage';
import { ProCard } from '@ant-design/pro-components';
import { Button } from 'antd';
import html2canvas from 'html2canvas';
import React, { useRef } from 'react';

const Html2Canvas: React.FC = () => {
  const captureRef = useRef(null);

  const handleScreenshot = () => {
    // let html2canvas = window.html2canvas;
    // console.log('html2canvas', html2canvas);
    const element = captureRef.current; // 要截图的 DOM 元素
    if (element) {
      html2canvas(element, { useCORS: true })
        .then((canvas) => {
          // 将截图转为图片格式
          const imgData = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = imgData;
          // link.download = "screenshot.png";
          link.download = `screenshot-${new Date().getTime()}.png`;
          link.click(); // 自动下载图片
        })
        .catch(() => {
          getMessage().error('截图失败，请重试');
        });
    }
  };

  return (
    <>
      <ProCard>
        {/* <div>Html2Canvas</div> */}
        <div ref={captureRef} style={{ padding: '20px', border: '1px solid #ccc' }}>
          <h1>哈喽, 这是一个 html2canvas 样本内容</h1>
          <p>这个div中的所有内容都将被捕获为图像。</p>
          <DemoColumn />
        </div>
        <Button onClick={handleScreenshot} style={{ marginTop: '20px' }}>
          捕获屏幕截图
        </Button>
      </ProCard>
    </>
  );
};

export default Html2Canvas;
