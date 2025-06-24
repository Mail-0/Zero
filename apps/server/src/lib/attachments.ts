export interface SerializedAttachment {
  name: string;
  type: string;
  base64: string;
  size?: number;
  lastModified?: number;
}

/**
 * Converts an array of serialized attachments (received from the client) into
 * lightweight File-like objects that the mail drivers expect. The returned
 * objects expose a compatible `arrayBuffer()` method so we don't need a real
 * `File` implementation inside the worker environment.
 */
export const toAttachmentFiles = (attachments: SerializedAttachment[] = []): any[] => {
  return attachments.map((data) => {
    const buffer = Buffer.from(data.base64, 'base64');
    // Typed as `any` so it can satisfy the File interface expected by the drivers.
    return {
      name: data.name,
      type: data.type,
      arrayBuffer: async () => {
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      },
    };
  });
}; 