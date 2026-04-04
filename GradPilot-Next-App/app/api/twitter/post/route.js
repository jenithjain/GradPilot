import { NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';

const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET;

/**
 * Create a Twitter client using OAuth 1.0a User Context
 * Mirrors the Python tweepy pattern:
 *   auth = tweepy.OAuth1UserHandler(api_key, api_secret, access_token, access_token_secret)
 *   api = tweepy.API(auth)         → client.v1 (media upload)
 *   client = tweepy.Client(...)    → client.v2 (create tweet)
 */
function getTwitterClient() {
  return new TwitterApi({
    appKey: TWITTER_API_KEY,
    appSecret: TWITTER_API_SECRET,
    accessToken: TWITTER_ACCESS_TOKEN,
    accessSecret: TWITTER_ACCESS_TOKEN_SECRET,
  });
}

export async function POST(req) {
  try {
    const { text, imageUrls } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_TOKEN_SECRET) {
      return NextResponse.json({
        success: false,
        error: 'Twitter credentials not configured',
        details: 'Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET in .env'
      }, { status: 400 });
    }

    // Truncate to 280 chars (matches Python: text[:277] + "...")
    let tweetText = text;
    if (tweetText.length > 280) {
      tweetText = tweetText.substring(0, 277) + '...';
      console.log('[twitter] Truncated to 280 chars');
    }

    const client = getTwitterClient();
    const mediaIds = [];

    // Upload images via v1.1 API (max 4 — matches Python: image_paths[:4])
    if (imageUrls && imageUrls.length > 0) {
      console.log(`[twitter] Uploading ${Math.min(imageUrls.length, 4)} image(s)...`);

      for (let i = 0; i < Math.min(imageUrls.length, 4); i++) {
        let imageUrl = imageUrls[i];

        // Handle dict/object format (matches Python: if isinstance(image_path, dict))
        if (typeof imageUrl === 'object' && imageUrl !== null) {
          imageUrl = imageUrl.url || imageUrl.thumbnail;
        }

        if (!imageUrl) {
          console.log(`[twitter] Skipping empty image path at index ${i}`);
          continue;
        }

        let tempFilePath = null;
        try {
          // Download image to a temp file (matches Python: _download_image)
          const imgResponse = await fetch(imageUrl);
          if (!imgResponse.ok) {
            console.error(`[twitter] Failed to fetch image: ${imageUrl} (${imgResponse.status})`);
            continue;
          }

          const imageBuffer = Buffer.from(await imgResponse.arrayBuffer());
          const contentType = imgResponse.headers.get('content-type') || 'image/png';
          const ext = contentType.includes('jpeg') ? '.jpg' : contentType.includes('gif') ? '.gif' : '.png';
          tempFilePath = path.join(os.tmpdir(), `twitter_upload_${Date.now()}_${i}${ext}`);
          await writeFile(tempFilePath, imageBuffer);

          // Upload to Twitter via v1.1 media_upload (matches Python: self.api.media_upload(local_path))
          console.log(`[twitter] Uploading image ${i + 1}/${Math.min(imageUrls.length, 4)}...`);
          const mediaId = await client.v1.uploadMedia(tempFilePath, { mimeType: contentType });
          mediaIds.push(mediaId);
          console.log(`[twitter] Image ${i + 1} uploaded: ${mediaId}`);
        } catch (imgError) {
          console.error(`[twitter] Failed to upload image ${i + 1}:`, imgError.message);
        } finally {
          // Clean up temp file (matches Python: os.remove(local_path))
          if (tempFilePath) {
            try { await unlink(tempFilePath); } catch {}
          }
        }
      }
    }

    // Post tweet via v2 API (matches Python: self.client.create_tweet(text=text, media_ids=media_ids))
    console.log('[twitter] Posting tweet...');
    const tweetPayload = { text: tweetText };
    if (mediaIds.length > 0) {
      tweetPayload.media = { media_ids: mediaIds };
      console.log(`[twitter] With ${mediaIds.length} image(s)`);
    }

    const result = await client.v2.tweet(tweetPayload);
    const tweetId = result.data?.id;

    // Build tweet URL (matches Python: f"https://twitter.com/{username}/status/{tweet_id}")
    let tweetUrl = `https://twitter.com/i/web/status/${tweetId}`;
    try {
      const me = await client.v2.me();
      if (me.data?.username) {
        tweetUrl = `https://twitter.com/${me.data.username}/status/${tweetId}`;
      }
    } catch {
      // Fallback URL is fine
    }

    console.log(`[twitter] Posted! ID: ${tweetId}, URL: ${tweetUrl}`);

    return NextResponse.json({
      success: true,
      post: result,
      tweet_id: tweetId,
      tweet_url: tweetUrl,
      message: 'Successfully posted to Twitter!'
    });

  } catch (error) {
    console.error('[twitter] Post failed:', error);

    const statusCode = error.data?.status || error.code || 500;
    const errorDetail = error.data?.detail || error.data?.title || error.message;

    return NextResponse.json({
      success: false,
      error: `Failed to post tweet: ${errorDetail}`,
      details: {
        status: statusCode,
        message: errorDetail,
        errors: error.data?.errors,
      }
    }, { status: typeof statusCode === 'number' && statusCode >= 400 ? statusCode : 500 });
  }
}
