import { NextResponse } from 'next/server';

/**
 * Legacy route - Images are now stored on Cloudinary
 * This route is kept for backward compatibility but returns a notice
 */
export async function GET(_req: Request, context: { params: Promise<{ filename: string }> | { filename: string } }) {
  const resolved = 'then' in context.params ? await context.params : context.params;
  const { filename } = resolved;
  
  return NextResponse.json({
    error: 'Images are now stored on Cloudinary',
    message: 'Local file serving is disabled for Vercel compatibility. All images are now hosted on Cloudinary CDN.',
    filename,
    info: 'Check the workflow output for Cloudinary URLs'
  }, { status: 410 }); // 410 Gone - resource no longer available
}
