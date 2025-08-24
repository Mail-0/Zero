/**
 * Hook for handling image loading within a document
 * This hook monitors all images in a document and calls the callback
 * when all images have loaded (or failed to load)
 */
export function useImageLoading(doc: Document, callback: () => void) {
  const images = doc.getElementsByTagName('img');
  let loadedImages = 0;

  if (images.length > 0) {
    Array.from(images).forEach((img) => {
      if (img.complete) {
        loadedImages++;
        if (loadedImages === images.length) {
          setTimeout(callback, 0);
        }
      } else {
        img.onload = img.onerror = () => {
          loadedImages++;
          if (loadedImages === images.length) {
            setTimeout(callback, 0);
          }
        };
      }
    });
  } else {
    // If there are no images, call the callback immediately
    callback();
  }

  // Return a cleanup function
  return () => {
    // Remove event listeners from images
    if (images.length > 0) {
      Array.from(images).forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    }
  };
}
