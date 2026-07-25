/**
 * Client-side image compression utility using Canvas API.
 * Compresses images to ≤100KB and optionally resizes to 1:1 aspect ratio.
 */

export interface CompressionOptions {
  maxSizeKB?: number;       // Target max file size in KB (default: 100)
  maxDimension?: number;    // Max width/height in px (default: 512)
  forceSquare?: boolean;    // Force 1:1 aspect ratio (default: true)
  format?: 'image/webp' | 'image/jpeg'; // Output format (default: webp)
  initialQuality?: number;  // Starting quality 0-1 (default: 0.85)
  minQuality?: number;      // Minimum quality before rejection (default: 0.3)
}

export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  quality: number;
  format: string;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxSizeKB: 20,
  maxDimension: 512,
  forceSquare: true,
  format: 'image/webp',
  initialQuality: 0.7,
  minQuality: 0.2,
};

/**
 * Load a File or Blob into an HTMLImageElement
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Draw image onto canvas with optional 1:1 crop and resize
 */
function drawToCanvas(
  img: HTMLImageElement,
  maxDimension: number,
  forceSquare: boolean
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  let dw: number, dh: number;

  if (forceSquare) {
    // Center-crop to square
    const minSide = Math.min(img.width, img.height);
    sx = (img.width - minSide) / 2;
    sy = (img.height - minSide) / 2;
    sw = minSide;
    sh = minSide;
    dw = Math.min(maxDimension, minSide);
    dh = dw;
  } else {
    // Fit within maxDimension preserving aspect ratio
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    dw = Math.round(img.width * scale);
    dh = Math.round(img.height * scale);
  }

  canvas.width = dw;
  canvas.height = dh;

  // Apply slight sharpening via imageSmoothingQuality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

  return canvas;
}

/**
 * Convert canvas to blob at given quality
 */
function canvasToBlob(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      format,
      quality
    );
  });
}

/**
 * Compress an image file to meet the target size.
 * Iteratively reduces quality until target is met or minQuality is reached.
 */
export async function compressImage(
  file: File | Blob,
  options?: CompressionOptions
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxBytes = opts.maxSizeKB * 1024;
  const originalSize = file.size;

  // If already under limit and no resize needed, return as-is for very small files
  if (originalSize <= maxBytes && originalSize < 10240) {
    return {
      blob: file instanceof File ? file : file,
      width: 0,
      height: 0,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      quality: 1,
      format: file.type,
    };
  }

  const img = await loadImage(file);
  const canvas = drawToCanvas(img, opts.maxDimension, opts.forceSquare);

  // Try WebP first, fallback to JPEG if not supported
  let format = opts.format;
  let quality = opts.initialQuality;
  let blob = await canvasToBlob(canvas, format, quality);

  // If WebP produces empty/tiny result, browser may not support it
  if (blob.size < 100 && format === 'image/webp') {
    format = 'image/jpeg';
    blob = await canvasToBlob(canvas, format, quality);
  }

  // Iteratively reduce quality to meet target
  while (blob.size > maxBytes && quality > opts.minQuality) {
    quality -= 0.05;
    blob = await canvasToBlob(canvas, format, Math.max(quality, opts.minQuality));
  }

  // If still too large, try reducing dimensions
  if (blob.size > maxBytes && opts.maxDimension > 256) {
    const smallerCanvas = drawToCanvas(img, Math.round(opts.maxDimension * 0.7), opts.forceSquare);
    quality = opts.initialQuality;
    blob = await canvasToBlob(smallerCanvas, format, quality);

    while (blob.size > maxBytes && quality > opts.minQuality) {
      quality -= 0.05;
      blob = await canvasToBlob(smallerCanvas, format, Math.max(quality, opts.minQuality));
    }
  }

  const compressedSize = blob.size;
  const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    originalSize,
    compressedSize,
    compressionRatio: Math.max(0, compressionRatio),
    quality: Math.round(quality * 100) / 100,
    format,
  };
}

/**
 * Check if a file exceeds the max size after compression attempt.
 * Returns true if the file is acceptable.
 */
export function isFileSizeAcceptable(blob: Blob, maxSizeKB: number = 20): boolean {
  return blob.size <= maxSizeKB * 1024;
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
