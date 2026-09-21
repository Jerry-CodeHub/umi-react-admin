import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Alert } from 'antd';
import { useState } from 'react';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { PdfStyle } from './Pdf.style';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// 静态资源根路径经 PUBLIC_PATH 拼接：主产线 '/'、GitHub Pages '/umi-react-admin/'，
// 三环境（dev / 静态部署 / gh-pages 子路径）均可正确解析
const options = {
  cMapUrl: `${PUBLIC_PATH}cmaps/`,
  isEvalSupported: false,
  standardFontDataUrl: `${PUBLIC_PATH}standard_fonts/`,
};

type PDFFile = string | File | null;

export default function Pdf() {
  const [file, setFile] = useState<PDFFile>(`${PUBLIC_PATH}react-dev.pdf`);
  const [numPages, setNumPages] = useState<number>();
  const [loadError, setLoadError] = useState<string | null>(null);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const { files } = event.target;

    if (files && files[0]) {
      setLoadError(null);
      setFile(files[0] || null);
    }
  }

  function onDocumentLoadSuccess({ numPages: nextNumPages }: PDFDocumentProxy): void {
    setNumPages(nextNumPages);
  }

  return (
    <PdfStyle>
      <PageContainer header={{ title: 'PDF' }}>
        <ProCard className="shadow-2xl" headerBordered>
          <div className="Example">
            <header>
              <h1>示例页面</h1>
            </header>
            <div className="Example__container">
              <div className="Example__container__load">
                <label htmlFor="file">Load from file:</label> <input onChange={onFileChange} type="file" />
              </div>
              <div className="Example__container__document">
                {loadError && (
                  <Alert
                    showIcon
                    type="warning"
                    message="文档加载失败，请选择本地文件重试"
                    description={loadError}
                    className="mb-4"
                  />
                )}
                <Document
                  file={file}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={(error: Error) => {
                    setLoadError(error?.message ? `原因：${error.message}` : '未知原因');
                  }}
                  options={options}
                >
                  {Array.from(new Array(numPages), (el, index) => (
                    <Page key={`page_${index + 1}`} pageNumber={index + 1} />
                  ))}
                </Document>
              </div>
            </div>
          </div>
        </ProCard>
      </PageContainer>
    </PdfStyle>
  );
}
