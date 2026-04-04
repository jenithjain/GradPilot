import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_REDIRECT_URI = process.env.NEXT_PUBLIC_TWITTER_REDIRECT_URI || 'http://localhost:3000/api/twitter/auth/callback';

function toBase64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function GET(req) {
  if (!TWITTER_CLIENT_ID) {
    return NextResponse.redirect(new URL('/profile?error=twitter_oauth_client_id_missing', req.url));
  }

  const { searchParams } = new URL(req.url);
  const forceLogin = searchParams.get('force_login') === '1' || searchParams.get('switch') === '1';
  const loginHint = searchParams.get('login_hint');

  // Step 1: Redirect user to Twitter OAuth 2.0 using PKCE.
  const state = toBase64Url(randomBytes(16));
  const codeVerifier = toBase64Url(randomBytes(32));
  const codeChallenge = toBase64Url(createHash('sha256').update(codeVerifier).digest());
  const scope = 'tweet.read tweet.write users.read offline.access';

  const oauthParams = new URLSearchParams({
    response_type: 'code',
    client_id: TWITTER_CLIENT_ID,
    redirect_uri: TWITTER_REDIRECT_URI,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  if (forceLogin) {
    oauthParams.set('force_login', 'true');
    oauthParams.set('prompt', 'login');
  }

  if (loginHint) {
    oauthParams.set('login_hint', loginHint);
  }

  const authUrl = `https://twitter.com/i/oauth2/authorize?${oauthParams.toString()}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('twitter_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });
  response.cookies.set('twitter_code_verifier', codeVerifier, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });

  return response;
}
