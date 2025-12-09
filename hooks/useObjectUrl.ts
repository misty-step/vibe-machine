import { useState, useEffect } from 'react';

/**
 * A hook that manages the lifecycle of an Object URL for a given File or Blob.
 * It automatically creates the URL when the file changes and revokes it
 * when the component unmounts or the file changes, preventing memory leaks.
 *
 * @param file The File or Blob object to create a URL for.
 * @returns The Object URL string, or null if no file is provided.
 */
export const useObjectUrl = (file: File | Blob | null): string | null => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return url;
};