import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { formatFileSize, getFileIcon } from '@/lib/utils';
import type { Attachment } from '@/types';
import { Paperclip } from 'lucide-react';

type Props = {
  attachments: Attachment[];
  setSelectedAttachment: (attachment: {
    id: string;
    name: string;
    type: string;
    url: string;
  }) => void;
};

const AttachmentsAccordion = ({ attachments, setSelectedAttachment }: Props) => {
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
              {attachments.map((attachment) => {
                const isImage = attachment.mimeType.includes('image');
                const dataUrl = `data:${attachment.mimeType};base64,${attachment.body}`;

                return (
                  <div
                    key={attachment.attachmentId}
                    className="w-48 flex-shrink-0 overflow-hidden rounded-md border transition-shadow hover:shadow-md"
                  >
                    <button
                      className="w-full text-left"
                      onClick={() =>
                        setSelectedAttachment({
                          id: attachment.attachmentId,
                          name: attachment.filename,
                          type: attachment.mimeType,
                          url: dataUrl,
                        })
                      }
                    >
                      <div className="bg-muted flex h-24 items-center justify-center">
                        {isImage ? (
                          <img
                            src={dataUrl}
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
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="max-w-[150px] overflow-hidden truncate text-ellipsis whitespace-nowrap text-sm font-medium"
                            title={attachment.filename}
                          >
                            {attachment.filename}
                          </span>
                          <span className="text-muted-foreground flex-shrink-0 text-xs">
                            {formatFileSize(attachment.size)}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default AttachmentsAccordion;
