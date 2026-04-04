import { uploadBase64ToCloudinary } from './cloudinary';

/**
 * Save base64 image to Cloudinary (Vercel-compatible)
 * @param base64Data - Base64 encoded image data
 * @param filePrefix - Prefix for the image file (used for folder organization)
 * @param ext - File extension
 * @returns Object with filename and Cloudinary URL
 */
export async function saveBase64Image(base64Data: string, filePrefix = 'image', ext = 'png') {
  console.log('[fs-helpers] saveBase64Image called:', {
    filePrefix,
    ext,
    dataLength: base64Data?.length || 0,
  });

  try {
    // Determine folder based on file prefix
    const folder = `campaign-images/${filePrefix}`;
    
    // Upload to Cloudinary (required for Vercel deployment)
    const result = await uploadBase64ToCloudinary(base64Data, folder);
    
    console.log('[fs-helpers] Upload successful:', {
      publicId: result.publicId,
      url: result.secureUrl,
    });

    return {
      filename: result.publicId,
      fullPath: result.secureUrl,
      cloudinaryUrl: result.secureUrl,
      publicId: result.publicId,
    };
  } catch (error) {
    console.error('[fs-helpers] Failed to save image:', error);
    throw error;
  }
}
