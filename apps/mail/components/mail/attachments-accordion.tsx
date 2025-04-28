import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { formatFileSize, getFileIcon } from '@/lib/utils';
import { Paperclip } from 'lucide-react';
import { Attachment } from '@/types';

type Props = {
  attachments: Attachment[];
  setSelectedAttachment: (attachment: {
    id: string;
    name: string;
    type: string;
    url: string;
  } | null) => void;
};

const AttachmentsAccordion = ({ attachments, setSelectedAttachment }: Props) => {
  const handleAttachmentClick = (attachment: Attachment) => {
    // Handle attachment preview
    try {
      // Convert base64 to blob for all attachments
      const byteCharacters = atob(attachment.body);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachment.mimeType });
      const blobUrl = URL.createObjectURL(blob);

      // Set selected attachment for preview
      setSelectedAttachment({
        id: attachment.attachmentId,
        name: attachment.filename,
        type: getAttachmentType(attachment.mimeType),
        url: blobUrl
      });
    } catch (error) {
      console.error('Error handling attachment:', error);
    }
  };

  const getAttachmentType = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
    return 'other';
  };

  return (
    <div className="px-4">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="attachments" className="border-0">
          <AccordionTrigger className="px-2 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Paperclip className="text-muted-foreground h-4 w-4" />
              <h3 className="text-sm font-medium">Attachments ({attachments.length})</h3>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.attachmentId}
                  className="w-48 flex-shrink-0 overflow-hidden rounded-md border transition-shadow hover:shadow-md"
                >
                  <button
                    className="w-full text-left"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAttachmentClick(attachment);
                    }}
                  >
                    <div className="bg-muted flex h-24 items-center justify-center">
                      {attachment.mimeType.startsWith('image/') ? (
                        <img
                          src={attachment.url || `data:${attachment.mimeType};base64,${attachment.body}`}
                          alt={attachment.filename}
                          className="max-h-full max-w-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            console.error('Failed to load image:', attachment.filename);
                          }}
                        />
                      ) : (
                        <div className="text-muted-foreground text-2xl">
                          {getFileIcon(attachment.mimeType)}
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-sm font-medium">{attachment.filename}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatFileSize(attachment.size)}
                      </p>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default AttachmentsAccordion;
