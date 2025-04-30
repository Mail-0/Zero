"use client";

import { useEffect, useState, useRef } from 'react';
import { Document, Page } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { pdfjs } from 'react-pdf';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.mjs`;

interface PDFViewerProps {
  url: string;
  onClose: () => void;
}

export function PDFViewer({ url }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
  }

  const changeScale = (delta: number) => {
    setScale((prevScale) => Math.min(Math.max(0.5, prevScale + delta), 2.0));
  };

  return (
    <>
      <div className="mx-auto sticky -top-7 sm:-top-6 left-0 right-0 bg-muted flex items-center justify-center gap-2 p-2 z-50 rounded-md">
        <button
          onClick={() => changeScale(-0.1)}
          disabled={scale <= 0.5}
          className="rounded-md border hover:opacity-80"
        >
          <ZoomOut className="h-6 w-6" />
        </button>
        <span className="text-sm">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => changeScale(0.1)}
          disabled={scale >= 2.0}
          className="rounded-md border hover:opacity-80"
        >
          <ZoomIn className="h-6 w-6" />
        </button>
      </div>
      <div className="relative flex flex-col h-full w-full bg-background">
        {/* PDF content with scroll */}
        <div className="flex-1 overflow-auto flex justify-center p-4">
          <div
            ref={containerRef}
            className="flex flex-col items-center"
            style={{ width: '100%', height: '100%' }}
          >
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              error={<div>Failed to load PDF</div>}
              loading={<div>Loading PDF...</div>}
            >
              {Array.from(new Array(numPages), (el, index) => (
                <Page
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  width={containerWidth}
                  scale={scale}
                  className={'mb-4'}
                />
              ))}
            </Document>
          </div>
        </div>
      </div>
    </>
  );
}