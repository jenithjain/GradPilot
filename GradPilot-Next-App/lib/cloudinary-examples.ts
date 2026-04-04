/**
 * Cloudinary Integration Examples
 * 
 * This file contains practical examples of using Cloudinary in your application.
 */

// ============================================================================
// Example 1: Upload a Base64 Image to Cloudinary
// ============================================================================

import { uploadBase64ToCloudinary } from '@/lib/cloudinary';

async function example1_uploadBase64() {
  // Base64 image data (with or without data URI prefix)
  const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  
  try {
    const result = await uploadBase64ToCloudinary(
      base64Image,
      'campaign-images/examples', // Folder in Cloudinary
      'my-custom-image'           // Optional custom ID
    );
    
    console.log('Uploaded successfully!');
    console.log('URL:', result.cloudinaryUrl);
    console.log('Public ID:', result.publicId);
    
    // Use the URL in your application
    return result.cloudinaryUrl;
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

// ============================================================================
// Example 2: Upload Multiple Images in Parallel
// ============================================================================

import { uploadMultipleToCloudinary } from '@/lib/cloudinary';

async function example2_uploadMultiple() {
  const images = [
    'base64_image_1_data',
    'base64_image_2_data',
    'base64_image_3_data',
  ];
  
  try {
    const results = await uploadMultipleToCloudinary(
      images,
      'campaign-images/batch'
    );
    
    console.log(`Uploaded ${results.length} images`);
    results.forEach((result, index) => {
      console.log(`Image ${index + 1}:`, result.cloudinaryUrl);
    });
    
    return results.map(r => r.cloudinaryUrl);
  } catch (error) {
    console.error('Batch upload failed:', error);
  }
}

// ============================================================================
// Example 3: Get Optimized Image URLs
// ============================================================================

import { getOptimizedUrl } from '@/lib/cloudinary';

function example3_optimizedUrls() {
  const publicId = 'campaign-images/campaign/image-123';
  
  // Thumbnail (200x200, auto quality, WebP format)
  const thumbnail = getOptimizedUrl(publicId, {
    width: 200,
    height: 200,
    quality: 'auto',
    format: 'webp',
    crop: 'fill'
  });
  
  // Medium size (800px wide, maintain aspect ratio)
  const medium = getOptimizedUrl(publicId, {
    width: 800,
    quality: 85,
    format: 'auto'
  });
  
  // High quality (for print or display)
  const highQuality = getOptimizedUrl(publicId, {
    quality: 100,
    format: 'png'
  });
  
  console.log('Thumbnail:', thumbnail);
  console.log('Medium:', medium);
  console.log('High Quality:', highQuality);
  
  return { thumbnail, medium, highQuality };
}

// ============================================================================
// Example 4: Delete an Image from Cloudinary
// ============================================================================

import { deleteFromCloudinary } from '@/lib/cloudinary';

async function example4_deleteImage() {
  const publicId = 'campaign-images/examples/my-custom-image';
  
  try {
    const result = await deleteFromCloudinary(publicId);
    console.log('Deleted successfully:', result);
  } catch (error) {
    console.error('Deletion failed:', error);
  }
}

// ============================================================================
// Example 5: Upload from Campaign Image Generation
// ============================================================================

import { saveBase64Image } from '@/lib/fs-helpers';

async function example5_campaignImageUpload() {
  // This is how images are uploaded during campaign execution
  const geminiGeneratedBase64 = 'your_base64_image_from_gemini';
  
  try {
    // Automatically uploads to Cloudinary
    const saved = await saveBase64Image(
      geminiGeneratedBase64,
      'campaign',  // Used as folder name: campaign-images/campaign/
      'png'
    );
    
    console.log('Image saved to Cloudinary');
    console.log('URL:', saved.cloudinaryUrl);
    console.log('Public ID:', saved.publicId);
    
    // This URL can now be used in social media posts
    return saved.cloudinaryUrl;
  } catch (error) {
    console.error('Campaign image upload failed:', error);
    // Falls back to local storage automatically
  }
}

// ============================================================================
// Example 6: Using Cloudinary URLs in API Calls
// ============================================================================

async function example6_socialMediaPost() {
  // After generating images, they're stored in Cloudinary
  const imageUrls = [
    'https://res.cloudinary.com/your-cloud/image/upload/v123/campaign-images/campaign/image-1.png',
    'https://res.cloudinary.com/your-cloud/image/upload/v123/campaign-images/campaign/image-2.png',
  ];
  
  // LinkedIn Post
  const linkedinResponse = await fetch('/api/linkedin/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Check out our new product launch! 🚀',
      imageUrls: imageUrls,
    }),
  });
  
  // Twitter Post
  const twitterResponse = await fetch('/api/twitter/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Exciting news! New product available now! 🎉',
      imageUrls: imageUrls.slice(0, 4), // Twitter max 4 images
    }),
  });
  
  console.log('Posted to LinkedIn and Twitter with Cloudinary images');
}

// ============================================================================
// Example 7: Manual Upload via API Endpoint
// ============================================================================

async function example7_apiUpload() {
  const base64Image = 'your_base64_image_data';
  
  const response = await fetch('/api/cloudinary/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64: base64Image,
      folder: 'campaign-images/manual',
      publicId: 'custom-id-123'
    }),
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Upload successful:', result.data.cloudinaryUrl);
  } else {
    console.error('Upload failed:', result.error);
  }
}

// ============================================================================
// Example 8: Manual Delete via API Endpoint
// ============================================================================

async function example8_apiDelete() {
  const publicId = 'campaign-images/manual/custom-id-123';
  
  const response = await fetch('/api/cloudinary/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId }),
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Deletion successful');
  } else {
    console.error('Deletion failed:', result.error);
  }
}

// ============================================================================
// Example 9: Error Handling with Fallback
// ============================================================================

async function example9_errorHandling() {
  try {
    const result = await uploadBase64ToCloudinary(
      'invalid_base64_data',
      'campaign-images/test'
    );
    console.log('Upload successful:', result.cloudinaryUrl);
  } catch (error) {
    console.error('Cloudinary upload failed:', error.message);
    
    // Fallback: use local storage
    console.log('Falling back to local storage...');
    // saveBase64Image automatically handles this fallback
  }
}

// ============================================================================
// Example 10: Complete Campaign Workflow with Cloudinary
// ============================================================================

async function example10_fullWorkflow() {
  console.log('Starting campaign workflow...');
  
  // Step 1: Generate images with Gemini AI
  const generatedImages = ['base64_1', 'base64_2', 'base64_3', 'base64_4'];
  
  // Step 2: Upload all images to Cloudinary
  const uploadPromises = generatedImages.map((base64, index) =>
    saveBase64Image(base64, 'campaign', 'png')
  );
  
  const uploadedImages = await Promise.all(uploadPromises);
  const imageUrls = uploadedImages.map(img => img.cloudinaryUrl);
  
  console.log(`Uploaded ${imageUrls.length} images to Cloudinary`);
  
  // Step 3: Store URLs in workflow output
  const workflowOutput = {
    images: uploadedImages.map((img, index) => ({
      file: img.publicId,
      url: img.cloudinaryUrl,
      theme: ['Minimal', 'Vibrant', 'Natural', 'Luxury'][index],
    })),
    meta: {
      type: 'ad_creatives',
      count: uploadedImages.length,
      storage: 'cloudinary',
    },
  };
  
  // Step 4: Use in social media posts
  await fetch('/api/linkedin/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Campaign launch! Check out these stunning visuals!',
      imageUrls: imageUrls,
    }),
  });
  
  console.log('Campaign workflow complete!');
  return workflowOutput;
}

// ============================================================================
// Export examples for testing
// ============================================================================

export {
  example1_uploadBase64,
  example2_uploadMultiple,
  example3_optimizedUrls,
  example4_deleteImage,
  example5_campaignImageUpload,
  example6_socialMediaPost,
  example7_apiUpload,
  example8_apiDelete,
  example9_errorHandling,
  example10_fullWorkflow,
};

/*
 * Usage in your code:
 * 
 * import { example1_uploadBase64 } from './cloudinary-examples';
 * 
 * // Then call the example
 * await example1_uploadBase64();
 */
