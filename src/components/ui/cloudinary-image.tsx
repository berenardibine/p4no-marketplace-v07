import { useState } from 'react';
import { cn } from '@/lib/utils';
import { optimizeCloudinaryUrl, getCloudinaryThumbnail } from '@/lib/cloudinary';

interface CloudinaryImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  useThumbnail?: boolean;
}

const CloudinaryImage = ({
  src,
  thumbnailWidth = 400,
  thumbnailHeight = 400,
  useThumbnail = false,
  className,
  alt = '',
  ...props
}: CloudinaryImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const optimizedSrc = useThumbnail
    ? getCloudinaryThumbnail(src, thumbnailWidth, thumbnailHeight)
    : optimizeCloudinaryUrl(src);

  if (error || !src) {
    return (
      <div className={cn('bg-muted flex items-center justify-center', className)}>
        <span className="text-muted-foreground text-xs">No image</span>
      </div>
    );
  }

  return (
    <img
      src={optimizedSrc}
      alt={alt}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      className={cn(
        'transition-opacity duration-300',
        loaded ? 'opacity-100' : 'opacity-0',
        className
      )}
      {...props}
    />
  );
};

export default CloudinaryImage;
