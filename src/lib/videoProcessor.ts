/**
 * p4no Advanced Video Processor (client-side)
 *
 * Strategy:
 * 1. Accept large raw uploads (up to RAW_CAP).
 * 2. Validate type and duration.
 * 3. Generate a watermarked thumbnail from frame 0.
 * 4. Upload raw video to Cloudinary VIDEO endpoint with aggressive
 *    H.264 mobile-first eager transformations + watermark overlay.
 * 5. Resolve to the optimized eager-derived URL.
 * 6. Validate the optimized variant size <= FINAL_CAP_KB (2MB).
 *    If above, the upload is rejected with a friendly message.
 */

const FINAL_CAP_KB = 2048;          // 2MB final optimized cap
const RAW_CAP_MB = 100;             // hard ceiling on raw input
const MAX_DURATION = 60;            // allow up to 60s; mobile reel friendly

const CLOUD_NAME = 'ddwrviw3v';
const UPLOAD_PRESET = 'smart_market_upload';
const VIDEO_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;

// Cloudinary eager transformation chain.
// - q_auto:low, optimized H.264, ≤720p vertical, low bitrate, watermark text bottom-right.
const EAGER_TRANSFORM =
  'q_auto:low,vc_h264,ac_aac,w_720,h_1280,c_limit,br_700k,fps_30/' +
  'l_text:Arial_30_bold:p4no%20%E2%80%A2%20Next%20Gen%20Trade,co_white,o_55,g_south_east,x_22,y_22';

export interface ProcessedVideoUpload {
  url: string;             // optimized CDN url
  thumbnailUrl: string;    // optimized thumbnail
  duration: number;
  bytes: number;           // optimized bytes
  width?: number;
  height?: number;
}

export interface UploadProgress {
  stage: 'validating' | 'thumbnail' | 'uploading' | 'optimizing' | 'done';
  percent: number;        // 0-100
  message: string;
}

function loadVideo(file: File | Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.src = URL.createObjectURL(file);
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error('Could not read this video file'));
  });
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const fs = Math.max(14, Math.min(w, h) * 0.045);
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.font = `bold ${fs}px Arial, sans-serif`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('p4no • Next Gen Trade', w - fs * 0.5, h - fs * 0.5);
  ctx.restore();
}

async function captureThumbnail(video: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const seek = () => {
      const canvas = document.createElement('canvas');
      const maxW = 720;
      const scale = Math.min(1, maxW / Math.max(1, video.videoWidth));
      canvas.width = Math.round(video.videoWidth * scale) || 720;
      canvas.height = Math.round(video.videoHeight * scale) || 1280;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      drawWatermark(ctx, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not generate thumbnail'))),
        'image/jpeg',
        0.78
      );
    };
    if (video.readyState >= 2) seek();
    else video.onseeked = seek;
    try {
      video.currentTime = 0.1;
    } catch {
      seek();
    }
  });
}

/** Upload via XHR so we can report progress. */
function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (p: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Invalid Cloudinary response')); }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

/** Add f_auto + q_auto pass-through helper for any video URL. */
export function optimizeVideoUrl(url: string): string {
  if (!url || !url.includes('cloudinary.com')) return url;
  if (url.includes('/q_auto') || url.includes('/upload/sp_')) return url;
  return url.replace('/upload/', '/upload/q_auto:low,f_auto/');
}

/** Probe the optimized variant to check final size; HEAD request. */
async function probeSize(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const len = r.headers.get('content-length');
    return len ? parseInt(len, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Run the full pipeline: validate -> thumbnail -> upload+transform -> verify.
 * Throws a friendly error message if final size > 2MB.
 */
export async function processAndUploadVideo(
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<ProcessedVideoUpload> {
  const emit = (p: UploadProgress) => onProgress?.(p);

  emit({ stage: 'validating', percent: 2, message: 'Checking video…' });

  if (!file.type.startsWith('video/')) {
    throw new Error('Please upload a valid video file.');
  }
  if (file.size > RAW_CAP_MB * 1024 * 1024) {
    throw new Error(`Video too large. Please upload a file under ${RAW_CAP_MB}MB.`);
  }

  const video = await loadVideo(file);
  if (video.duration > MAX_DURATION + 0.5) {
    throw new Error(
      `Reel videos must be ${MAX_DURATION}s or shorter (yours is ${video.duration.toFixed(1)}s).`
    );
  }

  emit({ stage: 'thumbnail', percent: 8, message: 'Generating preview…' });
  const thumbnailBlob = await captureThumbnail(video);

  // Upload thumbnail (re-uses image endpoint).
  const thumbFd = new FormData();
  thumbFd.append('file', thumbnailBlob);
  thumbFd.append('upload_preset', UPLOAD_PRESET);
  thumbFd.append('folder', 'smart_market/product-video-thumbs');
  const thumbRes = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: thumbFd }
  );
  if (!thumbRes.ok) throw new Error('Thumbnail upload failed');
  const thumbJson = await thumbRes.json();
  const thumbnailUrl: string = thumbJson.secure_url.replace(
    '/upload/',
    '/upload/f_auto,q_auto/'
  );

  emit({ stage: 'uploading', percent: 12, message: 'Uploading video…' });

  // Upload video with eager mobile-optimized + watermarked variant.
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);
  fd.append('folder', 'smart_market/product-videos');
  fd.append('eager', EAGER_TRANSFORM);
  fd.append('eager_async', 'false');

  const result = await uploadWithProgress(VIDEO_UPLOAD_URL, fd, (p) => {
    // Map raw upload 0-100 to 12-78 of overall.
    emit({
      stage: 'uploading',
      percent: 12 + Math.round(p * 0.66),
      message: `Uploading video… ${p}%`,
    });
  });

  emit({ stage: 'optimizing', percent: 82, message: 'Optimizing for mobile…' });

  // Prefer the eager-derived URL; fall back to inline transform on the original.
  const optimizedUrl: string =
    result?.eager?.[0]?.secure_url ||
    result.secure_url.replace('/upload/', `/upload/${EAGER_TRANSFORM}/`);

  // Probe final size.
  let finalBytes = result?.eager?.[0]?.bytes ?? null;
  if (!finalBytes) finalBytes = await probeSize(optimizedUrl);

  if (finalBytes && finalBytes > FINAL_CAP_KB * 1024) {
    throw new Error(
      'Your video could not be optimized below 2MB. Please upload a shorter or lower-quality video.'
    );
  }

  emit({ stage: 'done', percent: 100, message: 'Ready!' });

  return {
    url: optimizedUrl,
    thumbnailUrl,
    duration: video.duration,
    bytes: finalBytes ?? file.size,
    width: result.width,
    height: result.height,
  };
}

export const VIDEO_LIMITS = { FINAL_CAP_KB, RAW_CAP_MB, MAX_DURATION };

// ---- Backwards-compatible legacy export (used by older callers) ----
export interface ProcessedVideo {
  blob: Blob;
  thumbnailBlob: Blob;
  duration: number;
  size: number;
}

/** @deprecated Use processAndUploadVideo. Kept for legacy imports. */
export async function processVideo(file: File): Promise<ProcessedVideo> {
  if (!file.type.startsWith('video/')) throw new Error('Please upload a valid video file');
  const video = await loadVideo(file);
  if (video.duration > MAX_DURATION + 0.5) {
    throw new Error(`Video must be ${MAX_DURATION}s or shorter`);
  }
  const thumbnailBlob = await captureThumbnail(video);
  return { blob: file, thumbnailBlob, duration: video.duration, size: file.size };
}
