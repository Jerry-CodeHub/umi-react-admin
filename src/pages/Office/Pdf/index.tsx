import { PageContainer, ProCard } from '@ant-design/pro-components';
import { useState } from 'react';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

import { PdfStyle } from './Pdf.style';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();

const options = {
  cMapUrl: '/cmaps/',
  standardFontDataUrl: '/standard_fonts/',
};

type PDFFile = string | File | null;

export default function Pdf() {
  // let url = './react-dev.pdf';
  const [file, setFile] = useState<PDFFile>('/public/react-dev.pdf');
  const [numPages, setNumPages] = useState<number>();

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const { files } = event.target;

    if (files && files[0]) {
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
                <Document file={file} onLoadSuccess={onDocumentLoadSuccess} options={options}>
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
