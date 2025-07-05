export type ImageQuality = 'low' | 'medium' | 'original';

export interface ImageCompressionOptions {
  quality: ImageQuality;
  maxWidth?: number;
  maxHeight?: number;
}

export async function compressImage(
  file: File,
  options: ImageCompressionOptions
): Promise<File> {
  if (options.quality === 'original') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Failed to get canvas 2D context'));
      return;
    }
    
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(img.src);
      
      let { width, height } = img;
      
      let scaleX = 1;
      let scaleY = 1;
      
      if (options.maxWidth && width > options.maxWidth) {
        scaleX = options.maxWidth / width;
      }
      
      if (options.maxHeight && height > options.maxHeight) {
        scaleY = options.maxHeight / height;
      }

      const scale = Math.min(scaleX, scaleY);
      
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      const qualityValue = options.quality === 'low' ? 0.6 : 0.8;
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: file.lastModified,
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        file.type,
        qualityValue
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    
    img.src = URL.createObjectURL(file);
  });
}

export async function compressImages(
  files: File[],
  options: ImageCompressionOptions
): Promise<File[]> {
  const compressedFiles: File[] = [];
  
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      try {
        const compressedFile = await compressImage(file, options);
        compressedFiles.push(compressedFile);
      } catch (error) {
        console.warn(`Failed to compress ${file.name}:`, error);
        compressedFiles.push(file);
      }
    } else {
      compressedFiles.push(file);
    }
  }
  
  return compressedFiles;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getCompressionRatio(originalSize: number, compressedSize: number): number {
  return ((originalSize - compressedSize) / originalSize) * 100;
}