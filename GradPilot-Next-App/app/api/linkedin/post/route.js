import { NextResponse } from 'next/server';

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN; // You need to get this from LinkedIn Developer Portal

export async function POST(req) {
  const { text, access_token, imageUrls } = await req.json();
  if (!text) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 });
  }
  
  // Use provided token or fall back to app-level token
  const token = access_token || LINKEDIN_ACCESS_TOKEN;
  
  if (!token) {
    return NextResponse.json({ error: 'No access token available. Please set LINKEDIN_ACCESS_TOKEN in .env.local' }, { status: 400 });
  }
  
  // imageUrls can be Cloudinary URLs or any publicly accessible image URLs
  console.log('LinkedIn image count:', imageUrls?.length || 0);
  
  try {
    // Get user URN via OpenID Connect userinfo (requires openid + profile scopes)
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!profileRes.ok) {
      const errorData = await profileRes.json();
      return NextResponse.json({ error: 'Failed to get LinkedIn profile', details: errorData }, { status: 400 });
    }
    
    const profile = await profileRes.json();
    const author = `urn:li:person:${profile.sub}`;
    
    let mediaAssets = [];
    
    // Upload images if provided (max 9 for LinkedIn)
    if (imageUrls && imageUrls.length > 0) {
      console.log(`Uploading ${imageUrls.length} images to LinkedIn...`);
      
      for (const imageUrl of imageUrls.slice(0, 9)) {
        try {
          // Step 1: Register upload
          const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              registerUploadRequest: {
                recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                owner: author,
                serviceRelationships: [{
                  relationshipType: 'OWNER',
                  identifier: 'urn:li:userGeneratedContent',
                }],
              },
            }),
          });
          
          if (!registerRes.ok) {
            console.error('Failed to register upload:', await registerRes.json());
            continue;
          }
          
          const registerData = await registerRes.json();
          const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
          const asset = registerData.value.asset;
          
          // Step 2: Download image
          const imgResponse = await fetch(imageUrl);
          if (!imgResponse.ok) {
            console.error(`Failed to fetch image: ${imageUrl}`);
            continue;
          }
          
          const imageBuffer = await imgResponse.arrayBuffer();
          
          // Step 3: Upload image binary
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: imageBuffer,
          });
          
          if (uploadRes.ok) {
            mediaAssets.push(asset);
            console.log(`Uploaded image, asset: ${asset}`);
          } else {
            console.error('Image upload failed:', await uploadRes.text());
          }
        } catch (imgError) {
          console.error('Error uploading image:', imgError);
        }
      }
    }
    
    // Build post body
    const postBody = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: mediaAssets.length > 0 ? 'IMAGE' : 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };
    
    // Add media if we have uploaded assets
    if (mediaAssets.length > 0) {
      postBody.specificContent['com.linkedin.ugc.ShareContent'].media = mediaAssets.map(asset => ({
        status: 'READY',
        description: { text: 'Campaign image' },
        media: asset,
        title: { text: 'Campaign' },
      }));
      console.log(`Attaching ${mediaAssets.length} images to post`);
    }
    
    // Post content using UGC Post API
    const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(postBody),
    });
    
    if (!postRes.ok) {
      const errorData = await postRes.json();
      return NextResponse.json({ error: 'Failed to post to LinkedIn', details: errorData }, { status: postRes.status });
    }
    
    const postData = await postRes.json();
    return NextResponse.json({ success: true, post: postData });
  } catch (error) {
    console.error('LinkedIn posting error:', error);
    return NextResponse.json({ error: 'Failed to post to LinkedIn', details: error.message }, { status: 500 });
  }
}
