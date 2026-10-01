import DemoPage from '@/components/DemoPage';
import { useApi } from '@/hooks/useApi';
import { getDashboardOverview } from '@/services/ops';
import { DownloadOutlined, FileSyncOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Alert, Button, Card, Space, Spin, Upload } from 'antd';
import html2canvas from 'html2canvas';
import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { buildImagePdf, dataUrlToBytes } from './pdfWriter';
import ReportSheet, { SHEET } from './ReportSheet';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// 静态资源根路径经 PUBLIC_PATH 拼接：主产线 '/'、GitHub Pages '/umi-react-admin/'
const PDF_OPTIONS = {
  cMapUrl: `${PUBLIC_PATH}cmaps/`,
  isEvalSupported: false,
  standardFontDataUrl: `${PUBLIC_PATH}standard_fonts/`,
};
/** 图表动画结束后再截图 */
const CHART_SETTLE_MS = 1200;
const PAGE_WINDOW = 2;

export default function Pdf() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const { data: overview } = useApi(getDashboardOverview);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<Blob>();
  const [file, setFile] = useState<Blob | File>();
  const [numPages, setNumPages] = useState<number>();
  const [pageIndex, setPageIndex] = useState(0);
  const [loadError, setLoadError] = useState<string>();

  // 报告页渲染完成后逐页截图（2 倍分辨率）并封装为 PDF
  useEffect(() => {
    if (!overview || report) return undefined;
    const timer = setTimeout(async () => {
      try {
        const sheets = [...(sheetRef.current?.querySelectorAll<HTMLElement>('.report-sheet') ?? [])];
        const pages = [];
        // 逐页截图（并发截图会互相抢主线程，反而更慢）
        for (const sheet of sheets) {
          const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: '#ffffff' });
          pages.push({
            jpeg: dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92)),
            width: canvas.width,
            height: canvas.height,
          });
        }
        const blob = new Blob([buildImagePdf(pages) as BlobPart], { type: 'application/pdf' });
        setReport(blob);
        setFile(blob);
      } catch (error) {
        console.error('[pdf] report generation failed', error);
        setLoadError(error instanceof Error ? error.message : String(error));
      }
    }, CHART_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [overview, report]);

  const download = () => {
    if (!report) return;
    const url = URL.createObjectURL(report);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'monthly-report.pdf';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const open = (next: Blob | File) => {
    setLoadError(undefined);
    setPageIndex(0);
    setNumPages(undefined);
    setFile(next);
  };

  return (
    <DemoPage
      descriptionId="page.pdf.desc"
      source="src/pages/Document/Pdf/pdfWriter.ts"
      extra={
        <Space wrap>
          {file && file !== report && (
            <Button icon={<FileSyncOutlined />} onClick={() => report && open(report)}>
              {t('pdf.backToReport')}
            </Button>
          )}
          <Upload accept="application/pdf,.pdf" showUploadList={false} beforeUpload={(f) => (open(f), false)}>
            <Button icon={<FolderOpenOutlined />}>{t('pdf.loadFile')}</Button>
          </Upload>
          <Button type="primary" icon={<DownloadOutlined />} disabled={!report} onClick={download}>
            {t('pdf.download')}
          </Button>
        </Space>
      }
    >
      <Card styles={{ body: { background: 'var(--ant-color-fill-tertiary)' } }}>
        {loadError && (
          <Alert showIcon type="warning" className="mb-4" message={t('pdf.loadFailed')} description={loadError} />
        )}
        {!file && !loadError ? (
          <div className="flex min-h-[480px] items-center justify-center">
            <Spin tip={t('pdf.generating')}>
              <div className="h-24 w-64" />
            </Spin>
          </div>
        ) : (
          <>
            {/* react-pdf 11 默认走 Suspense + Error Boundary；本页沿用 onLoadError 驱动的告警，关闭 suspense */}
            <Document
              suspense={false}
              file={file}
              options={PDF_OPTIONS}
              onLoadSuccess={({ numPages: total }) => setNumPages(total)}
              onLoadError={(error: Error) => setLoadError(error?.message)}
              className="flex flex-col items-center gap-4"
            >
              {Array.from({ length: numPages ?? 0 }, (_, index) => index)
                .slice(pageIndex, pageIndex + PAGE_WINDOW)
                .map((index) => (
                  <Page
                    key={index}
                    pageNumber={index + 1}
                    width={Math.min(794, window.innerWidth - 96)}
                    className="shadow-lg"
                  />
                ))}
            </Document>
            {numPages && numPages > PAGE_WINDOW ? (
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button disabled={pageIndex === 0} onClick={() => setPageIndex((i) => Math.max(0, i - PAGE_WINDOW))}>
                  {t('pdf.prev')}
                </Button>
                <span>
                  {t('pdf.pages', {
                    from: pageIndex + 1,
                    to: Math.min(pageIndex + PAGE_WINDOW, numPages),
                    total: numPages,
                  })}
                </span>
                <Button
                  disabled={pageIndex + PAGE_WINDOW >= numPages}
                  onClick={() => setPageIndex((i) => i + PAGE_WINDOW)}
                >
                  {t('pdf.next')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>
      {/* 屏幕外渲染报告纸面：只用于截图生成 PDF，生成后卸载 */}
      {overview && !report && (
        <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -SHEET.width * 2 }}>
          <ReportSheet ref={sheetRef} overview={overview} />
        </div>
      )}
    </DemoPage>
  );
}
