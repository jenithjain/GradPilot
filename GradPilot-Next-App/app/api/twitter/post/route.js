import { NextResponse } from 'next/server';
import crypto from 'crypto';

const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET;

// Generate OAuth 1.0a signature
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret || '')}`;
  
  return crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');
}

// Generate OAuth 1.0a Authorization header
function generateOAuthHeader(method, url, requestParams = {}) {
  const oauthParams = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(32).toString('base64').replace(/\W/g, ''),
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams, ...requestParams };
  const signature = generateOAuthSignature(method, url, allParams, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN_SECRET);
  
  oauthParams.oauth_signature = signature;

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return authHeader;
}

export async function POST(req) {
  const { text, imageUrls } = await req.json();
  
  if (!text) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 });
  }
  
  // imageUrls can be Cloudinary URLs or any publicly accessible image URLs
  console.log('Twitter credentials check:', {
    hasApiKey: !!TWITTER_API_KEY,
    hasApiSecret: !!TWITTER_API_SECRET,
    hasAccessToken: !!TWITTER_ACCESS_TOKEN,
    hasAccessTokenSecret: !!TWITTER_ACCESS_TOKEN_SECRET,
    apiKeyLength: TWITTER_API_KEY?.length,
    accessTokenLength: TWITTER_ACCESS_TOKEN?.length,
    imageCount: imageUrls?.length || 0,
  });
  
  if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_TOKEN_SECRET) {
    return NextResponse.json({ 
      error: 'Twitter credentials not configured',
      details: 'Please set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_TOKEN_SECRET in .env.local'
    }, { status: 400 });
  }
  
  try {
    let mediaIds = [];
    
    // Upload images if provided (max 4 for Twitter)
    if (imageUrls && imageUrls.length > 0) {
      console.log(`Uploading ${imageUrls.length} images to Twitter...`);
      
      for (const imageUrl of imageUrls.slice(0, 4)) {
        try {
          // Download image
          const imgResponse = await fetch(imageUrl);
          if (!imgResponse.ok) {
            console.error(`Failed to fetch image: ${imageUrl}`);
            continue;
          }
          
          const imageBuffer = await imgResponse.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString('base64');
          
          // Upload to Twitter Media API (v1.1)
          const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
          const uploadParams = { media_data: base64Image };
          const uploadAuthHeader = generateOAuthHeader('POST', uploadUrl, uploadParams);
          
          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Authorization': uploadAuthHeader,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(uploadParams),
          });
          
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            mediaIds.push(uploadData.media_id_string);
            console.log(`Uploaded image, media_id: ${uploadData.media_id_string}`);
          } else {
            const errorData = await uploadRes.json();
            console.error('Image upload failed:', errorData);
          }
        } catch (imgError) {
          console.error('Error uploading image:', imgError);
        }
      }
    }
    
    // Post tweet with media (with retry for 503/5xx errors)
    const url = 'https://api.twitter.com/2/tweets';
    
    const tweetBody = { text };
    if (mediaIds.length > 0) {
      tweetBody.media = { media_ids: mediaIds };
      console.log(`Attaching ${mediaIds.length} images to tweet`);
    }

    const MAX_RETRIES = 3;
    let lastError = null;
    let lastStatus = 0;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // Generate fresh OAuth header per attempt (new timestamp + nonce)
      const authHeader = generateOAuthHeader('POST', url);
      console.log(`[Attempt ${attempt}/${MAX_RETRIES}] OAuth header (first 80 chars):`, authHeader.substring(0, 80));

      const postRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tweetBody),
      });

      if (postRes.ok) {
        const responseData = await postRes.json();
        console.log('Twitter post successful:', responseData);
        return NextResponse.json({ success: true, post: responseData });
      }

      const responseData = await postRes.json().catch(() => ({ error: postRes.statusText }));
      lastError = responseData;
      lastStatus = postRes.status;

      console.error(`[Attempt ${attempt}] Twitter API Error (${postRes.status}):`, responseData);

      // Only retry on 5xx server errors or 429 rate limit
      if (postRes.status < 500 && postRes.status !== 429) {
        return NextResponse.json({ 
          error: 'Failed to post to Twitter', 
          details: responseData 
        }, { status: postRes.status });
      }

      // Wait before retry: 2s, 5s, 10s
      if (attempt < MAX_RETRIES) {
        const delay = attempt === 1 ? 2000 : attempt === 2 ? 5000 : 10000;
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    // All retries failed — if we had media, try once without media
    if (mediaIds.length > 0) {
      console.log('All retries with media failed. Attempting tweet without media...');
      const fallbackBody = { text };
      const fallbackAuth = generateOAuthHeader('POST', url);
      const fallbackRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': fallbackAuth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackBody),
      });

      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        console.log('Twitter post successful (without media):', fallbackData);
        return NextResponse.json({ success: true, post: fallbackData, note: 'Posted without media due to API errors' });
      }
    }

    // Final failure
    console.error('All Twitter posting attempts failed');
    return NextResponse.json({ 
      error: 'Failed to post to Twitter after multiple attempts', 
      details: lastError 
    }, { status: lastStatus });
  } catch (error) {
    console.error('Twitter posting error:', error);
    return NextResponse.json({ 
      error: 'Failed to post to Twitter', 
      details: error.message 
    }, { status: 500 });
  }
}
