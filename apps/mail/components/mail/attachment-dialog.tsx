import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Download, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { PDFViewer, ZoomControls } from '@/components/mail/pdf-viewer';
import { useEffect, useState } from 'react'

type Props = {
  selectedAttachment: {
    id: string;
    name: string;
    type: string;
    url: string;
  } | null;
  setSelectedAttachment: (
    attachment: null | {
      id: string;
      name: string;
      type: string;
      url: string;
    },
  ) => void;
};

const AttachmentDialog = ({ selectedAttachment, setSelectedAttachment }: Props) => {
  const [scale, setScale] = useState(1.0);

  const resetScale = () => {
    setScale(1.0);
  };

  // Cleanup blob URL when dialog unmounts or attachment changes to prevent memory leaks
  const cleanupBlobUrl = () => {
    if (selectedAttachment?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(selectedAttachment.url);
    }
  };
  useEffect(() => {
    return () => {
      cleanupBlobUrl();
      resetScale();
    }
  }, [selectedAttachment]);

  return (
    <Dialog
      open={!!selectedAttachment}
      onOpenChange={(open) => {
        if (!open) {
          cleanupBlobUrl();
          setSelectedAttachment(null);
        }
      }}
    >
      <DialogContent className="!max-w-6xl">
        <div className="w-full max-w-[85vw] md:max-w-[80vw] mx-auto">
          <div className="flex flex-col h-full">
            <DialogHeader className="mb-3">
              <DialogTitle className="flex items-center justify-between">
                <span>{selectedAttachment?.name}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={selectedAttachment?.url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <Download className="mr-1 h-4 w-4" />
                      <span className="hidden sm:inline">Download</span>
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedAttachment?.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <ExternalLink className="mr-1 h-4 w-4" />
                      <span className="hidden sm:inline">Open</span>
                    </a>
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            <ZoomControls scale={scale} onScaleChange={setScale} />
            <div className="bg-muted flex min-h-[300px] items-center justify-center rounded-md px-4 sm:px-5 -mt-3">
              {selectedAttachment?.type === 'image' ? (
                <img
                  src={selectedAttachment.url || '/placeholder.svg'}
                  alt={selectedAttachment.name}
                  className="max-h-full max-w-full object-contain"
                />
              ) : selectedAttachment?.type === 'pdf' ? (
                <div className="w-full h-full mx-auto">
                  <PDFViewer
                    url={selectedAttachment.url}
                    scale={scale}
                  />
                </div>
              ) : (
                <div className="text-center">
                  <div className="mb-4 text-6xl">
                    {selectedAttachment?.type === 'excel' && '📊'}
                    {selectedAttachment?.type === 'word' && '📝'}
                    {selectedAttachment &&
                      !['excel', 'word', 'image'].includes(selectedAttachment.type) &&
                      '📎'}
                  </div>
                  <p className="text-muted-foreground">Preview not available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttachmentDialog;
