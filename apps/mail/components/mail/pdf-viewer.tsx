"use client";

import { useEffect, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { Button } from '@/components/ui/button';
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

export function PDFViewer({ url, onClose }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState(true);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
    setIsLoading(false);
  }

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) =>
      Math.min(Math.max(1, prevPageNumber + offset), numPages)
    );
  };

  const changeScale = (delta: number) => {
    setScale((prevScale) =>
      Math.min(Math.max(0.5, prevScale + delta), 2.0)
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {pageNumber} of {numPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => changeScale(-0.1)}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => changeScale(0.1)}
            disabled={scale >= 2.0}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex justify-center p-4">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div>Loading PDF...</div>}
          error={<div>Error loading PDF!</div>}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            loading={<div>Loading page...</div>}
            renderAnnotationLayer={true}
            renderTextLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}