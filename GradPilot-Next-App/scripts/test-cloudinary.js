/**
 * Test script to verify Cloudinary integration
 * Run with: node scripts/test-cloudinary.js
 */

require('dotenv').config({ path: '.env.local' });
const { v2: cloudinary } = require('cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testCloudinaryConnection() {
  console.log('🧪 Testing Cloudinary Configuration (Vercel-Compatible)...\n');

  // Check credentials
  console.log('📋 Configuration:');
  console.log('  Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME || '❌ Missing');
  console.log('  API Key:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('  API Secret:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');
  console.log('');
  console.log('ℹ️  Note: This implementation uses Cloudinary exclusively (no local file storage)');
  console.log('   This ensures compatibility with Vercel\'s serverless environment.\n');

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Cloudinary credentials are not properly configured in .env.local');
    process.exit(1);
  }

  try {
    // Test connection by uploading a simple test image
    console.log('🚀 Testing image upload...');
    
    // Create a simple 1x1 red pixel PNG in base64
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    const dataUri = `data:image/png;base64,${testImageBase64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'campaign-images/test',
      resource_type: 'image',
      public_id: `test-${Date.now()}`,
    });

    console.log('✅ Upload successful!');
    console.log('  Public ID:', result.public_id);
    console.log('  URL:', result.secure_url);
    console.log('  Format:', result.format);
    console.log('  Size:', result.bytes, 'bytes');
    console.log('');

    // Test deletion
    console.log('🗑️  Testing image deletion...');
    const deleteResult = await cloudinary.uploader.destroy(result.public_id);
    console.log('✅ Deletion successful!');
    console.log('  Result:', deleteResult.result);
    console.log('');

    console.log('🎉 All Cloudinary tests passed! Your integration is ready to use.');
    
  } catch (error) {
    console.error('❌ Cloudinary test failed:', error.message);
    if (error.error) {
      console.error('   Error details:', error.error);
    }
    process.exit(1);
  }
}

testCloudinaryConnection();
