import { PageContainer, ProCard } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Alert, Button } from 'antd';
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
  const intl = useIntl();
  const [file, setFile] = useState<PDFFile>(`${PUBLIC_PATH}demo.pdf`);
  const [numPages, setNumPages] = useState<number>();
  const [loadError, setLoadError] = useState<string | null>(null);
  // 可见区分页：一次只渲染当前页与相邻页（此前 15 页 canvas 全量渲染，perf-9）
  const [pageIndex, setPageIndex] = useState(0);
  const PAGE_WINDOW = 2;

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const { files } = event.target;

    if (files && files[0]) {
      setLoadError(null);
      // 换文件后回到第一组，避免旧页码超出新文档页数导致空白
      setPageIndex(0);
      setFile(files[0] || null);
    }
  }

  function onDocumentLoadSuccess({ numPages: nextNumPages }: PDFDocumentProxy): void {
    setNumPages(nextNumPages);
    setPageIndex((index) => (index < nextNumPages ? index : 0));
  }

  return (
    <PdfStyle>
      <PageContainer header={{ title: 'PDF' }}>
        <ProCard className="shadow-2xl" headerBordered>
          <div className="Example">
            <header>
              <h1>{intl.formatMessage({ id: 'pdf.title' })}</h1>
            </header>
            <div className="Example__container">
              <div className="Example__container__load">
                <label htmlFor="file">{intl.formatMessage({ id: 'pdf.loadFile' })}</label>{' '}
                <input accept="application/pdf,.pdf" id="file" onChange={onFileChange} type="file" />
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
                  {Array.from(new Array(numPages), (el, index) => index)
                    .slice(pageIndex, pageIndex + PAGE_WINDOW)
                    .map((index) => (
                      <Page key={`page_${index + 1}`} pageNumber={index + 1} />
                    ))}
                </Document>
                {numPages && numPages > PAGE_WINDOW ? (
                  <div className="mb-4 flex items-center justify-center gap-3">
                    <Button
                      disabled={pageIndex === 0}
                      onClick={() => setPageIndex((i) => Math.max(0, i - PAGE_WINDOW))}
                    >
                      上一组
                    </Button>
                    <span>
                      {pageIndex + 1} - {Math.min(pageIndex + PAGE_WINDOW, numPages)} / {numPages} 页
                    </span>
                    <Button
                      disabled={pageIndex + PAGE_WINDOW >= numPages}
                      // 按组步进（1-2、3-4、5…），末组可不满，不再回退重叠
                      onClick={() => setPageIndex((i) => i + PAGE_WINDOW)}
                    >
                      下一组
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </ProCard>
      </PageContainer>
    </PdfStyle>
  );
}
