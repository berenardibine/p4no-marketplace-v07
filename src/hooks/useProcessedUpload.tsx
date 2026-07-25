import { useState } from 'react';
import { processImage } from '@/lib/imageProcessor';
import { uploadToCloudinary, optimizeCloudinaryUrl, CloudinaryUploadError } from '@/lib/cloudinary';
import { useToast } from '@/hooks/use-toast';

interface UseProcessedUploadOptions {
  folder?: string;
  productName?: string;
  removeBackground?: boolean;
  addWatermark?: boolean;
  onSuccess?: (url: string) => void;
  onError?: (error: string) => void;
}

export const useProcessedUpload = (options: UseProcessedUploadOptions = {}) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState('');

  const upload = async (file: File | Blob): Promise<string | null> => {
    setIsUploading(true);
    setProgress(10);

    try {
      // Step 1: Process image (bg removal, watermark, compress)
      setProcessingStage('Processing image...');
      setProgress(20);

      const processed = await processImage(file, {
        productName: options.productName,
        removeBackground: options.removeBackground ?? false,
        addWatermark: options.addWatermark ?? true,
        maxSizeKB: 100,
        maxDimension: 1024,
      });

      setProgress(60);
      setProcessingStage('Uploading to cloud...');

      // Step 2: Upload processed blob to Cloudinary with SEO filename
      const processedFile = new File([processed.blob], processed.filename, {
        type: processed.blob.type,
      });

      const result = await uploadToCloudinary(processedFile, options.folder || 'products');
      setProgress(90);

      const optimizedUrl = optimizeCloudinaryUrl(result.secure_url);
      setProgress(100);

      const savedPercent = Math.round((1 - processed.processedSize / processed.originalSize) * 100);

      toast({
        title: '✅ Image processed & uploaded',
        description: `Optimized: ${(processed.processedSize / 1024).toFixed(0)}KB (${savedPercent > 0 ? savedPercent + '% smaller' : 'optimized'})`,
      });

      options.onSuccess?.(optimizedUrl);
      return optimizedUrl;
    } catch (err) {
      const message = err instanceof CloudinaryUploadError
        ? err.message
        : err instanceof Error
        ? err.message
        : 'Image processing failed. Please try uploading again.';

      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
      options.onError?.(message);
      return null;
    } finally {
      setIsUploading(false);
      setProgress(0);
      setProcessingStage('');
    }
  };

  return { upload, isUploading, progress, processingStage };
};
