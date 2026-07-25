const CLOUD_NAME = 'ddwrviw3v';
const UPLOAD_PRESET = 'smart_market_upload';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export class CloudinaryUploadError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'CloudinaryUploadError';
  }
}

/**
 * Validate a file before upload
 */
export const validateImageFile = (file: File): string | null => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Invalid file type. Only JPG, PNG, and WEBP are allowed.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Maximum size is 2MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`;
  }
  return null;
};

/**
 * Upload a single image to Cloudinary using unsigned upload preset
 */
export const uploadToCloudinary = async (
  file: File | Blob,
  folder?: string
): Promise<CloudinaryUploadResult> => {
  // Validate if it's a File (has type property)
  if (file instanceof File) {
    const error = validateImageFile(file);
    if (error) throw new CloudinaryUploadError(error, 'VALIDATION');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  if (folder) {
    formData.append('folder', `smart_market/${folder}`);
  }

  try {
    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new CloudinaryUploadError(
        errorData?.error?.message || `Upload failed with status ${response.status}`,
        'UPLOAD_FAILED'
      );
    }

    const data = await response.json();
    return {
      secure_url: data.secure_url,
      public_id: data.public_id,
      width: data.width,
      height: data.height,
      format: data.format,
      bytes: data.bytes,
    };
  } catch (err) {
    if (err instanceof CloudinaryUploadError) throw err;
    throw new CloudinaryUploadError(
      'Network error. Please check your connection and try again.',
      'NETWORK'
    );
  }
};

/**
 * Add Cloudinary auto-optimization transforms to a URL
 * Inserts /f_auto,q_auto/ for automatic format and quality optimization
 */
export const optimizeCloudinaryUrl = (url: string): string => {
  if (!url || !url.includes('cloudinary.com')) return url;
  // Already optimized
  if (url.includes('/f_auto') || url.includes('/q_auto')) return url;
  // Insert transforms after /upload/
  return url.replace('/upload/', '/upload/f_auto,q_auto/');
};

/**
 * Get a resized version of a Cloudinary image
 */
export const getCloudinaryThumbnail = (url: string, width = 400, height = 400): string => {
  if (!url || !url.includes('cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/c_fill,w_${width},h_${height},f_auto,q_auto/`);
};
