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
  scale: number;
}

interface ZoomControlsProps {
  scale: number;
  onScaleChange: (newScale: number) => void;
}

export function ZoomControls({ scale, onScaleChange }: ZoomControlsProps) {
  const changeScale = (delta: number) => {
    const newScale = Math.min(Math.max(0.5, scale + delta), 2.0);
    if (newScale !== scale) {
      onScaleChange(newScale);
    }
  };

  return (
    <div className="mx-auto w-full sticky -top-7 sm:-top-6 left-0 right-0 bg-muted flex items-center justify-center gap-3 px-3 py-2 z-50 rounded-md">
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
  )
}

export function PDFViewer({ url, scale}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
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

  return (
    <div className="relative flex flex-col h-full w-full bg-background pb-1">
      {/* PDF content with scroll */}
      <div className="flex-1 overflow-auto flex justify-center">
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
            className="m-auto"
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
  );
}