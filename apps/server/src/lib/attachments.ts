export interface SerializedAttachment {
  name: string;
  type: string;
  base64: string;
  size?: number;
  lastModified?: number;
}

export interface AttachmentFile {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}


export const toAttachmentFiles = (attachments: SerializedAttachment[] = []): AttachmentFile[] => {
  return attachments.map((data) => {
    const buffer = Buffer.from(data.base64, 'base64');
    return {
      name: data.name,
      type: data.type,
      arrayBuffer: async () => {
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      },
    };
  });
}; 