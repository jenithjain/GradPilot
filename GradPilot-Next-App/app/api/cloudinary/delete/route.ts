import { NextResponse } from 'next/server';
import { deleteFromCloudinary } from '@/lib/cloudinary';

/**
 * Delete an image from Cloudinary
 * DELETE /api/cloudinary/delete
 * Body: { publicId: string }
 */
export async function DELETE(req: Request) {
  try {
    const { publicId } = await req.json();

    if (!publicId) {
      return NextResponse.json(
        { error: 'Missing publicId' },
        { status: 400 }
      );
    }

    const result = await deleteFromCloudinary(publicId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Deletion failed',
      },
      { status: 500 }
    );
  }
}
