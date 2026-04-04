import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const TWITTER_REDIRECT_URI = process.env.NEXT_PUBLIC_TWITTER_REDIRECT_URI || 'http://localhost:3000/api/twitter/auth/callback';

export async function GET(req) {
  // Step 2: Handle Twitter OAuth callback
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const storedState = req.cookies.get('twitter_oauth_state')?.value;
  const codeVerifier = req.cookies.get('twitter_code_verifier')?.value;

  if (!code) {
    return NextResponse.redirect(new URL('/profile?error=twitter_auth_failed', req.url));
  }

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL('/profile?error=twitter_state_mismatch', req.url));
  }

  if (!codeVerifier) {
    return NextResponse.redirect(new URL('/profile?error=twitter_code_verifier_missing', req.url));
  }

  if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/profile?error=twitter_client_config_missing', req.url));
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64') },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: TWITTER_REDIRECT_URI,
      client_id: TWITTER_CLIENT_ID,
      code_verifier: codeVerifier,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return NextResponse.redirect(new URL('/profile?error=twitter_token_failed', req.url));
  }

  // Store token in user's account
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/profile?error=twitter_session_missing', req.url));
  }

  try {
    await dbConnect();
    const updated = await User.findByIdAndUpdate(
      session.user.id,
      {
        'socialTokens.twitter': {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expires_in,
          connected_at: new Date()
        }
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.redirect(new URL('/profile?error=twitter_user_not_found', req.url));
    }
  } catch (error) {
    console.error('Error storing Twitter token:', error);
    return NextResponse.redirect(new URL('/profile?error=twitter_store_failed', req.url));
  }

  const response = NextResponse.redirect(new URL('/profile?twitter=connected', req.url));
  response.cookies.set('twitter_oauth_state', '', { path: '/', maxAge: 0 });
  response.cookies.set('twitter_code_verifier', '', { path: '/', maxAge: 0 });
  return response;
}
