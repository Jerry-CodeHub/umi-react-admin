import { ProCard } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import { useEffect, useRef } from 'react';
import SignaturePad from 'signature_pad';

import { SignatureStyle } from './Signature.styles';

export default function Signature() {
  const [messageApi, contextHolder] = message.useMessage();
  const signaturePadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    const canvas = document.getElementById('signature-pad') as HTMLCanvasElement | null;
    if (!canvas) return;

    function resizeCanvas() {
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
    });
    signaturePadRef.current = signaturePad;

    const savePngButton = document.getElementById('save-png') as HTMLButtonElement | null;
    const clearBtn = document.getElementById('clear') as HTMLButtonElement | null;
    const drawBtn = document.getElementById('draw') as HTMLButtonElement | null;
    const eraseBtn = document.getElementById('erase') as HTMLButtonElement | null;
    const undoBtn = document.getElementById('undo') as HTMLButtonElement | null;

    function handleSavePng() {
      if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
        messageApi.warning('请先提供签名.');
        return;
      }
      function dataURLToBlob(dataURL: string) {
        const parts = dataURL.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const uInt8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i);
        return new Blob([uInt8Array], { type: contentType });
      }
      const dataURL = signaturePadRef.current.toDataURL('image/png');
      const blob = dataURLToBlob(dataURL);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'signature.png';
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }

    function handleClear() {
      signaturePadRef.current?.clear();
    }
    function handleDraw() {
      if (signaturePadRef.current) signaturePadRef.current.compositeOperation = 'source-over';
    }
    function handleErase() {
      if (signaturePadRef.current) signaturePadRef.current.compositeOperation = 'destination-out';
    }
    function handleUndo() {
      if (!signaturePadRef.current) return;
      const data = signaturePadRef.current.toData();
      if (data) {
        data.pop();
        signaturePadRef.current.fromData(data);
      }
    }

    savePngButton?.addEventListener('click', handleSavePng);
    clearBtn?.addEventListener('click', handleClear);
    drawBtn?.addEventListener('click', handleDraw);
    eraseBtn?.addEventListener('click', handleErase);
    undoBtn?.addEventListener('click', handleUndo);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      savePngButton?.removeEventListener('click', handleSavePng);
      clearBtn?.removeEventListener('click', handleClear);
      drawBtn?.removeEventListener('click', handleDraw);
      eraseBtn?.removeEventListener('click', handleErase);
      undoBtn?.removeEventListener('click', handleUndo);
      signaturePadRef.current?.off();
    };
  }, [messageApi]);

  return (
    <SignatureStyle>
      {contextHolder}
      <ProCard className="h-full shadow-2xl">
        <div className="wrapper">
          <canvas id="signature-pad" className="signature-pad"></canvas>
        </div>
        <div className="flex justify-between max-w-3xl mt-8 min-w-96 mb-28">
          <Button id="save-png">保存为 PNG</Button>
          <Button id="draw">画</Button>
          <Button id="erase">擦除</Button>
          <Button id="undo">撤销</Button>
          <Button id="clear">清除</Button>
        </div>
      </ProCard>
    </SignatureStyle>
  );
}
