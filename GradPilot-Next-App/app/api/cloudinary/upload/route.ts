import { NextResponse } from 'next/server';
import { uploadBase64ToCloudinary } from '@/lib/cloudinary';

/**
 * Upload an image to Cloudinary
 * POST /api/cloudinary/upload
 * Body: { base64: string, folder?: string, publicId?: string }
 */
export async function POST(req: Request) {
  try {
    const { base64, folder, publicId } = await req.json();

    if (!base64) {
      return NextResponse.json(
        { error: 'Missing base64 image data' },
        { status: 400 }
      );
    }

    const result = await uploadBase64ToCloudinary(
      base64,
      folder || 'campaign-images',
      publicId
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      { status: 500 }
    );
  }
}
