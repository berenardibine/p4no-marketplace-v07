/**
 * p4no AI Image Processing Pipeline
 * Processes images BEFORE uploading to Cloudinary:
 * 1. Optional background removal (white bg)
 * 2. p4no watermark (logo + slogan)
 * 3. Compression & optimization
 * 4. SEO filename generation
 */

const WATERMARK_TEXT = 'p4no';
const WATERMARK_SLOGAN = 'Next Generation of Trade';
const WATERMARK_OPACITY = 0.6;

interface ProcessingOptions {
  productName?: string;
  removeBackground?: boolean;
  addWatermark?: boolean;
  maxSizeKB?: number;
  maxDimension?: number;
}

interface ProcessedImage {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  originalSize: number;
  processedSize: number;
}

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
 * Simple background removal using canvas edge detection.
 * Replaces near-white / uniform backgrounds with pure white.
 */
function removeBackground(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Sample corners to detect background color
  const corners = [
    0, // top-left
    (canvas.width - 1) * 4, // top-right
    (canvas.height - 1) * canvas.width * 4, // bottom-left
    ((canvas.height - 1) * canvas.width + canvas.width - 1) * 4, // bottom-right
  ];

  let bgR = 0, bgG = 0, bgB = 0;
  for (const idx of corners) {
    bgR += data[idx];
    bgG += data[idx + 1];
    bgB += data[idx + 2];
  }
  bgR = Math.round(bgR / 4);
  bgG = Math.round(bgG / 4);
  bgB = Math.round(bgB / 4);

  const threshold = 60;

  for (let i = 0; i < data.length; i += 4) {
    const dr = Math.abs(data[i] - bgR);
    const dg = Math.abs(data[i + 1] - bgG);
    const db = Math.abs(data[i + 2] - bgB);

    if (dr < threshold && dg < threshold && db < threshold) {
      data[i] = 255;     // R
      data[i + 1] = 255; // G
      data[i + 2] = 255; // B
      data[i + 3] = 255; // A
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Add p4no watermark matching brand logo design: colored "p4no" + orange slogan
 */
function addWatermark(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const w = canvas.width;
  const h = canvas.height;

  const baseFontSize = Math.max(14, Math.min(w, h) * 0.05);
  const sloganFontSize = baseFontSize * 0.45;
  const margin = baseFontSize * 0.8;

  ctx.save();

  // No background strip — text rendered directly on image

  // Brand text "p4no" with colored letters
  ctx.globalAlpha = 0.55;
  ctx.textBaseline = 'top';
  ctx.font = `bold ${baseFontSize}px 'Arial Black', 'Arial', sans-serif`;

  // Light outline/shadow for readability on any background
  ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const brandText = 'p4no';
  const brandColors = ['#FF0000', '#FFDD00', '#00CC00', '#FF8C00'];
  const brandY = h - baseFontSize * 2.4 - margin;

  // Measure char widths
  const charWidths: number[] = [];
  let totalWidth = 0;
  for (const ch of brandText) {
    const cw = ctx.measureText(ch).width;
    charWidths.push(cw);
    totalWidth += cw;
  }

  let offsetX = w - margin - totalWidth;
  for (let i = 0; i < brandText.length; i++) {
    ctx.fillStyle = brandColors[i % brandColors.length];
    ctx.fillText(brandText[i], offsetX, brandY);
    offsetX += charWidths[i];
  }

  // Slogan in orange
  ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
  ctx.shadowBlur = 2;
  ctx.fillStyle = '#FF6A00';
  ctx.font = `bold ${sloganFontSize}px 'Arial', sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(WATERMARK_SLOGAN, w - margin, brandY + baseFontSize * 1.15);

  ctx.restore();
}

/**
 * Generate SEO-friendly filename
 */
function generateSEOFilename(productName?: string): string {
  const base = productName
    ? productName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 50)
    : 'product';

  return `${base}-p4no.webp`;
}

/**
 * Canvas to blob with iterative quality reduction
 */
async function canvasToOptimizedBlob(
  canvas: HTMLCanvasElement,
  maxSizeKB: number,
  initialQuality = 0.82,
  minQuality = 0.25
): Promise<Blob> {
  let quality = initialQuality;
  let format = 'image/webp';

  const toBlob = (q: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        format,
        q
      );
    });

  let blob = await toBlob(quality);

  // Fallback to JPEG if WebP isn't supported
  if (blob.size < 100) {
    format = 'image/jpeg';
    blob = await toBlob(quality);
  }

  const maxBytes = maxSizeKB * 1024;
  while (blob.size > maxBytes && quality > minQuality) {
    quality -= 0.05;
    blob = await toBlob(Math.max(quality, minQuality));
  }

  // If still too large, reduce canvas size
  if (blob.size > maxBytes) {
    const scale = 0.7;
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = Math.round(canvas.width * scale);
    smallCanvas.height = Math.round(canvas.height * scale);
    const sCtx = smallCanvas.getContext('2d')!;
    sCtx.imageSmoothingEnabled = true;
    sCtx.imageSmoothingQuality = 'high';
    sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
    quality = initialQuality;
    blob = await new Promise<Blob>((resolve, reject) =>
      smallCanvas.toBlob(b => (b ? resolve(b) : reject()), format, quality)
    );
    while (blob.size > maxBytes && quality > minQuality) {
      quality -= 0.05;
      blob = await new Promise<Blob>((resolve, reject) =>
        smallCanvas.toBlob(b => (b ? resolve(b) : reject()), format, Math.max(quality, minQuality))
      );
    }
  }

  return blob;
}

/**
 * Main processing pipeline
 */
export async function processImage(
  file: File | Blob,
  options: ProcessingOptions = {}
): Promise<ProcessedImage> {
  const {
    productName,
    removeBackground: shouldRemoveBg = false,
    addWatermark: shouldWatermark = true,
    maxSizeKB = 100,
    maxDimension = 1024,
  } = options;

  const originalSize = file.size;
  const img = await loadImage(file);

  // Create canvas and resize
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Step 1: Background removal
  if (shouldRemoveBg) {
    removeBackground(canvas, ctx);
  }

  // Step 2: Watermark
  if (shouldWatermark) {
    addWatermark(canvas, ctx);
  }

  // Step 3: Compress
  const blob = await canvasToOptimizedBlob(canvas, maxSizeKB);

  // Step 4: SEO filename
  const filename = generateSEOFilename(productName);

  return {
    blob,
    filename,
    width: canvas.width,
    height: canvas.height,
    originalSize,
    processedSize: blob.size,
  };
}

export { generateSEOFilename };
