import { v2 as cloudinary } from 'cloudinary';

// Validate Cloudinary environment variables
if (!process.env.CLOUDINARY_CLOUD_NAME) {
  console.error('[Cloudinary] CLOUDINARY_CLOUD_NAME is not set in environment variables');
}
if (!process.env.CLOUDINARY_API_KEY) {
  console.error('[Cloudinary] CLOUDINARY_API_KEY is not set in environment variables');
}
if (!process.env.CLOUDINARY_API_SECRET) {
  console.error('[Cloudinary] CLOUDINARY_API_SECRET is not set in environment variables');
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('[Cloudinary] Configuration loaded:', {
  hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
  hasApiKey: !!process.env.CLOUDINARY_API_KEY,
  hasApiSecret: !!process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  cloudinaryUrl: string;
}

/**
 * Upload a base64 image to Cloudinary
 * @param base64Data - Base64 encoded image data (with or without data URL prefix)
 * @param folder - Folder path in Cloudinary (e.g., 'campaign-images/linkedin')
 * @param publicId - Optional custom public ID for the image
 * @returns Upload result with URLs and metadata
 */
export async function uploadBase64ToCloudinary(
  base64Data: string,
  folder: string = 'campaign-images',
  publicId?: string
): Promise<CloudinaryUploadResult> {
  console.log('[Cloudinary] Starting upload:', {
    folder,
    publicId,
    dataLength: base64Data?.length || 0,
    hasData: !!base64Data,
  });

  try {
    // Validate input
    if (!base64Data) {
      throw new Error('No base64 data provided');
    }

    // Clean base64 data - add data URL prefix if not present
    let dataUri = base64Data;
    if (!base64Data.startsWith('data:')) {
      // Default to PNG if no MIME type specified
      dataUri = `data:image/png;base64,${base64Data}`;
    }

    const uploadOptions: any = {
      folder,
      resource_type: 'image',
      overwrite: false,
      unique_filename: true,
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    console.log('[Cloudinary] Upload options:', uploadOptions);
    const result = await cloudinary.uploader.upload(dataUri, uploadOptions);
    console.log('[Cloudinary] Upload successful:', {
      publicId: result.public_id,
      url: result.secure_url,
      format: result.format,
      size: result.bytes,
    });

    return {
      url: result.url,
      secureUrl: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      cloudinaryUrl: result.secure_url, // Use secure URL by default
    };
  } catch (error) {
    console.error('[Cloudinary] Upload failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      folder,
      publicId,
    });
    throw new Error(`Failed to upload image to Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload a buffer to Cloudinary
 * @param buffer - Image buffer
 * @param folder - Folder path in Cloudinary
 * @param publicId - Optional custom public ID
 * @returns Upload result with URLs and metadata
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string = 'campaign-images',
  publicId?: string
): Promise<CloudinaryUploadResult> {
  const base64 = buffer.toString('base64');
  return uploadBase64ToCloudinary(`data:image/png;base64,${base64}`, folder, publicId);
}

/**
 * Upload multiple images to Cloudinary
 * @param images - Array of base64 image data
 * @param folder - Folder path in Cloudinary
 * @returns Array of upload results
 */
export async function uploadMultipleToCloudinary(
  images: string[],
  folder: string = 'campaign-images'
): Promise<CloudinaryUploadResult[]> {
  const uploadPromises = images.map((image, index) =>
    uploadBase64ToCloudinary(image, folder, `image-${Date.now()}-${index}`)
  );
  return Promise.all(uploadPromises);
}

/**
 * Delete an image from Cloudinary by public ID
 * @param publicId - The public ID of the image to delete
 * @returns Deletion result
 */
export async function deleteFromCloudinary(publicId: string): Promise<{ result: string }> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    throw new Error(`Failed to delete image from Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get optimized Cloudinary URL with transformations
 * @param publicId - Public ID of the image
 * @param options - Transformation options (width, height, quality, format, etc.)
 * @returns Optimized Cloudinary URL
 */
export function getOptimizedUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: number | 'auto';
    format?: string;
    crop?: string;
  } = {}
): string {
  return cloudinary.url(publicId, {
    transformation: [
      {
        width: options.width,
        height: options.height,
        quality: options.quality || 'auto',
        fetch_format: options.format || 'auto',
        crop: options.crop || 'limit',
      },
    ],
    secure: true,
  });
}

export default cloudinary;
