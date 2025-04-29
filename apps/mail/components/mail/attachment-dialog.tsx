import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Download, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { PDFViewer } from '@/components/mail/pdf-viewer';
import { useEffect } from 'react'

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

  // Cleanup blob URL when dialog unmounts or attachment changes to prevent memory leaks
  const cleanupBlobUrl = () => {
    if (selectedAttachment?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(selectedAttachment.url);
    }
  };
  useEffect(() => {
    return cleanupBlobUrl;
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
        <DialogHeader>
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
        <div className="bg-muted mt-2 flex min-h-[300px] items-center justify-center rounded-md p-4">
          {selectedAttachment?.type === 'image' ? (
            <img
              src={selectedAttachment.url || '/placeholder.svg'}
              alt={selectedAttachment.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : selectedAttachment?.type === 'pdf' ? (
            <div className="w-full h-full ">
              <PDFViewer
                url={selectedAttachment.url}
                onClose={() => setSelectedAttachment(null)}
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
      </DialogContent>
    </Dialog>
  );
};

export default AttachmentDialog;
