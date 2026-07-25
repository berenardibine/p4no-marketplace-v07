import { useState } from 'react';
import { uploadToCloudinary, optimizeCloudinaryUrl, CloudinaryUploadError } from '@/lib/cloudinary';
import { useToast } from '@/hooks/use-toast';

interface UseCloudinaryUploadOptions {
  folder?: string;
  onSuccess?: (url: string) => void;
  onError?: (error: string) => void;
}

export const useCloudinaryUpload = (options: UseCloudinaryUploadOptions = {}) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File | Blob): Promise<string | null> => {
    setIsUploading(true);
    setProgress(10);

    try {
      setProgress(30);
      const result = await uploadToCloudinary(file, options.folder);
      setProgress(90);

      const optimizedUrl = optimizeCloudinaryUrl(result.secure_url);
      setProgress(100);

      toast({
        title: '✅ Image uploaded',
        description: `Size: ${(result.bytes / 1024).toFixed(0)}KB`,
      });

      options.onSuccess?.(optimizedUrl);
      return optimizedUrl;
    } catch (err) {
      const message = err instanceof CloudinaryUploadError
        ? err.message
        : 'Upload failed. Please try again.';

      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
      options.onError?.(message);
      return null;
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const uploadMultiple = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const url = await upload(file);
      if (url) urls.push(url);
    }
    return urls;
  };

  return { upload, uploadMultiple, isUploading, progress };
};
