import { NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET;

function getErrorStatus(error) {
  return error?.data?.status || error?.code || 500;
}

function getErrorMessage(error) {
  return error?.data?.detail || error?.data?.title || error?.message || 'Unknown Twitter API error';
}

function isRetriableStatus(status) {
  return [429, 500, 502, 503, 504].includes(Number(status));
}

function isNoCreditsError(error) {
  const status = Number(getErrorStatus(error));
  const message = `${error?.data?.detail || ''} ${error?.data?.title || ''} ${error?.message || ''}`;
  return status === 402 && /does not have any credits|no credits to fulfill this request/i.test(message);
}

function isOAuth1Token89Error(error) {
  const status = Number(getErrorStatus(error));
  const message = `${error?.data?.detail || ''} ${error?.data?.title || ''} ${error?.message || ''}`;
  return status === 401 && /(code\s*89|invalid or expired token)/i.test(message);
}

function getTweetIdFromResult(result) {
  return result?.data?.id || result?.id_str || result?.id;
}

function getHeaderValue(headers, key) {
  if (!headers) return undefined;
  return headers[key] || headers[key?.toLowerCase?.()] || undefined;
}

async function getTweetUrl(client, tweetId) {
  if (!tweetId) return null;
  try {
    const me = await client.v2.me();
    if (me?.data?.username) {
      return `https://twitter.com/${me.data.username}/status/${tweetId}`;
    }
  } catch {
    // Fallback URL below
  }
  return `https://twitter.com/i/web/status/${tweetId}`;
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getUserTwitterOAuth2Token() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;

    await dbConnect();
    const user = await User.findById(session.user.id).select('+socialTokens');
    return user?.socialTokens?.twitter?.access_token || null;
  } catch (error) {
    console.warn('[twitter] Could not load user OAuth2 token from DB:', error?.message || error);
    return null;
  }
}

async function postWithOAuth2Bearer(accessToken, payload) {
  const response = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw {
      code: response.status,
      data,
      headers: Object.fromEntries(response.headers.entries()),
      message: data?.detail || data?.title || `Request failed with code ${response.status}`,
    };
  }

  return data;
}

async function preflightOAuth2UserToken(accessToken) {
  const response = await fetch('https://api.x.com/2/users/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    data,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

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
    const { text, imageUrls, access_token } = await req.json();
    const oauth2UserToken = access_token || await getUserTwitterOAuth2Token();
    const hasOAuth1Credentials = !!(TWITTER_API_KEY && TWITTER_API_SECRET && TWITTER_ACCESS_TOKEN && TWITTER_ACCESS_TOKEN_SECRET);

    console.log('[twitter] Token sources:', {
      hasCallerOAuth2Token: !!access_token,
      hasResolvedOAuth2Token: !!oauth2UserToken,
      hasOAuth1Credentials,
    });

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    if (!hasOAuth1Credentials && !oauth2UserToken) {
      return NextResponse.json({
        success: false,
        error: 'Twitter credentials not configured',
        details: 'Set OAuth1 env credentials or connect Twitter account to store OAuth2 user token.'
      }, { status: 400 });
    }

    if (access_token) {
      console.log('[twitter] Using OAuth2 access token provided by caller');
    }

    if (oauth2UserToken) {
      const preflight = await preflightOAuth2UserToken(oauth2UserToken);
      if (!preflight.ok) {
        const preflightMessage = preflight.data?.detail || preflight.data?.title || 'OAuth2 token preflight failed';
        const txId = getHeaderValue(preflight.headers, 'x-transaction-id') || getHeaderValue(preflight.headers, 'x-client-transaction-id');
        console.warn(`[twitter] OAuth2 preflight failed (${preflight.status}): ${preflightMessage}`, txId ? { txId } : {});

        const isAccessLevelIssue =
          preflight.status === 403 &&
          /client forbidden|appropriate level of api access|attached to a project/i.test(
            `${preflight.data?.title || ''} ${preflight.data?.detail || ''}`
          );

        if (isAccessLevelIssue) {
          return NextResponse.json({
            success: false,
            error: 'Twitter app access-level/project configuration issue',
            details: {
              status: 403,
              message: preflightMessage,
              reason: preflight.data?.reason,
              client_id: preflight.data?.client_id,
              note: 'X API reports this app is not authorized for this v2 endpoint. Verify the app is attached to a Project and your account has the required API access level, then reconnect Twitter to mint a fresh token.'
            }
          }, { status: 403 });
        }
      }
    }

    // Truncate to 280 chars (matches Python: text[:277] + "...")
    let tweetText = text;
    if (tweetText.length > 280) {
      tweetText = tweetText.substring(0, 277) + '...';
      console.log('[twitter] Truncated to 280 chars');
    }

    const oauth1Client = hasOAuth1Credentials ? getTwitterClient() : null;
    const mediaIds = [];

    // Upload images via v1.1 API (max 4 — matches Python: image_paths[:4])
    if (imageUrls && imageUrls.length > 0) {
      if (!oauth1Client) {
        console.warn('[twitter] Skipping image uploads because OAuth1 credentials are missing. Will try text-only post.');
      }

      if (!oauth1Client) {
        // Keep mediaIds empty and continue with text-only attempts.
      } else {
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
            const mediaId = await oauth1Client.v1.uploadMedia(tempFilePath, { mimeType: contentType });
            mediaIds.push(mediaId);
            console.log(`[twitter] Image ${i + 1} uploaded: ${mediaId}`);
          } catch (imgError) {
            console.error(`[twitter] Failed to upload image ${i + 1}:`, imgError.message);
            if (isOAuth1Token89Error(imgError)) {
              console.warn('[twitter] OAuth1 token appears invalid/revoked (code 89). Stopping remaining media uploads.');
              break;
            }
          } finally {
            // Clean up temp file (matches Python: os.remove(local_path))
            if (tempFilePath) {
              try { await unlink(tempFilePath); } catch {}
            }
          }
        }
      }
    }

    const tweetPayload = { text: tweetText };
    if (mediaIds.length > 0) {
      tweetPayload.media = { media_ids: mediaIds };
      console.log(`[twitter] With ${mediaIds.length} image(s)`);
    }

    // Strategy 1: Post using OAuth2 Bearer user token (recommended by current X v2 docs).
    let lastError = null;
    if (oauth2UserToken) {
      console.log('[twitter] Posting tweet via OAuth2 Bearer /2/tweets...');
      const bearerDelays = [0, 1500, 4000];

      for (let i = 0; i < bearerDelays.length; i++) {
        if (bearerDelays[i] > 0) {
          const jitter = Math.floor(Math.random() * 750);
          await wait(bearerDelays[i] + jitter);
        }

        try {
          const result = await postWithOAuth2Bearer(oauth2UserToken, tweetPayload);
          const tweetId = getTweetIdFromResult(result);
          const oauth2Client = new TwitterApi(oauth2UserToken);
          const tweetUrl = await getTweetUrl(oauth2Client, tweetId);

          console.log(`[twitter] Posted via OAuth2 on attempt ${i + 1}. ID: ${tweetId}`);
          return NextResponse.json({
            success: true,
            post: result,
            tweet_id: tweetId,
            tweet_url: tweetUrl,
            message: 'Successfully posted to Twitter with OAuth2.'
          });
        } catch (attemptError) {
          lastError = attemptError;
          const status = getErrorStatus(attemptError);
          const txId = getHeaderValue(attemptError?.headers, 'x-transaction-id') || getHeaderValue(attemptError?.headers, 'x-client-transaction-id');
          console.error(`[twitter] OAuth2 attempt ${i + 1} failed (${status}): ${getErrorMessage(attemptError)}`, txId ? { txId } : {});

          if (isNoCreditsError(attemptError)) {
            return NextResponse.json({
              success: false,
              error: 'X API credit limit reached for enrolled account',
              details: {
                status: 402,
                message: getErrorMessage(attemptError),
                note: 'Your enrolled X account has no API credits left. Add billing/credits in the X developer portal (or use an account/project with available credits), then reconnect and retry.'
              }
            }, { status: 402 });
          }

          if (!isRetriableStatus(status)) break;
        }
      }
    }

    // Strategy 2: v2 post with OAuth1 via library (legacy fallback).
    console.log('[twitter] Posting tweet via v2 OAuth1 fallback...');
    const delays = [0, 2000, 5000, 10000];

    for (let i = 0; i < delays.length && oauth1Client; i++) {
      if (delays[i] > 0) {
        const jitter = Math.floor(Math.random() * 750);
        await wait(delays[i] + jitter);
      }

      try {
        const attemptClient = getTwitterClient();
        const result = await attemptClient.v2.tweet(tweetPayload);
        const tweetId = getTweetIdFromResult(result);
        const tweetUrl = await getTweetUrl(attemptClient, tweetId);

        console.log(`[twitter] Posted via v2 on attempt ${i + 1}. ID: ${tweetId}`);
        return NextResponse.json({
          success: true,
          post: result,
          tweet_id: tweetId,
          tweet_url: tweetUrl,
          message: 'Successfully posted to Twitter!'
        });
      } catch (attemptError) {
        lastError = attemptError;
        const status = getErrorStatus(attemptError);
        const txId = attemptError?.headers?.['x-transaction-id'] || attemptError?.headers?.['x-client-transaction-id'];
        console.error(`[twitter] v2 attempt ${i + 1} failed (${status}): ${getErrorMessage(attemptError)}`, txId ? { txId } : {});

        if (!isRetriableStatus(status)) {
          break;
        }
      }
    }

    // Strategy 3: v1 fallback if v2 is unstable and OAuth1 creds are present.
    if (oauth1Client) {
      console.log('[twitter] Falling back to v1 tweet endpoint...');
      try {
        const fallbackClient = getTwitterClient();
        const v1Result = mediaIds.length > 0
          ? await fallbackClient.v1.tweet(tweetText, { media_ids: mediaIds })
          : await fallbackClient.v1.tweet(tweetText);

        const tweetId = getTweetIdFromResult(v1Result);
        const tweetUrl = await getTweetUrl(fallbackClient, tweetId);

        console.log(`[twitter] Posted via v1 fallback. ID: ${tweetId}`);
        return NextResponse.json({
          success: true,
          post: v1Result,
          tweet_id: tweetId,
          tweet_url: tweetUrl,
          message: 'Successfully posted to Twitter via fallback endpoint.'
        });
      } catch (v1Error) {
        lastError = v1Error;
        const status = getErrorStatus(v1Error);
        const txId = getHeaderValue(v1Error?.headers, 'x-transaction-id') || getHeaderValue(v1Error?.headers, 'x-client-transaction-id');
        console.error(`[twitter] v1 fallback failed (${status}): ${getErrorMessage(v1Error)}`, txId ? { txId } : {});
      }
    }

    // Strategy 4: final text-only fallback to salvage campaign run.
    if (mediaIds.length > 0) {
      console.log('[twitter] Trying text-only fallback...');

      if (oauth2UserToken) {
        try {
          const textResult = await postWithOAuth2Bearer(oauth2UserToken, { text: tweetText });
          const tweetId = getTweetIdFromResult(textResult);
          const oauth2Client = new TwitterApi(oauth2UserToken);
          const tweetUrl = await getTweetUrl(oauth2Client, tweetId);
          return NextResponse.json({
            success: true,
            post: textResult,
            tweet_id: tweetId,
            tweet_url: tweetUrl,
            message: 'Posted text-only tweet via OAuth2 after media failures.'
          });
        } catch (textOnlyOAuth2Error) {
          lastError = textOnlyOAuth2Error;
          const status = getErrorStatus(textOnlyOAuth2Error);
          const txId = getHeaderValue(textOnlyOAuth2Error?.headers, 'x-transaction-id') || getHeaderValue(textOnlyOAuth2Error?.headers, 'x-client-transaction-id');
          console.error(`[twitter] text-only OAuth2 fallback failed (${status}): ${getErrorMessage(textOnlyOAuth2Error)}`, txId ? { txId } : {});
        }
      }

      try {
        if (!oauth1Client) throw new Error('OAuth1 text-only fallback skipped: credentials not present');
        const textOnlyClient = getTwitterClient();
        const textResult = await textOnlyClient.v2.tweet({ text: tweetText });
        const tweetId = getTweetIdFromResult(textResult);
        const tweetUrl = await getTweetUrl(textOnlyClient, tweetId);

        return NextResponse.json({
          success: true,
          post: textResult,
          tweet_id: tweetId,
          tweet_url: tweetUrl,
          message: 'Posted text-only tweet after media endpoint failures.'
        });
      } catch (textOnlyError) {
        lastError = textOnlyError;
        const status = getErrorStatus(textOnlyError);
        const txId = getHeaderValue(textOnlyError?.headers, 'x-transaction-id') || getHeaderValue(textOnlyError?.headers, 'x-client-transaction-id');
        console.error(`[twitter] text-only fallback failed (${status}): ${getErrorMessage(textOnlyError)}`, txId ? { txId } : {});
      }
    }

    const finalStatus = getErrorStatus(lastError);
    const finalMessage = getErrorMessage(lastError);
    return NextResponse.json({
      success: false,
      error: `Failed to post tweet: ${finalMessage}`,
      details: {
        status: Number(finalStatus) || 500,
        message: finalMessage,
        note: 'X API may be experiencing transient server issues. Retry later if status is 503/5xx.'
      }
    }, { status: Number(finalStatus) >= 400 ? Number(finalStatus) : 500 });

  } catch (error) {
    console.error('[twitter] Post failed:', error);

    const statusCode = getErrorStatus(error);
    const errorDetail = getErrorMessage(error);

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
