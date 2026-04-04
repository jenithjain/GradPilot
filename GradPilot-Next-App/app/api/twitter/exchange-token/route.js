import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { code, codeVerifier } = await request.json();

    if (!code || !codeVerifier) {
      return NextResponse.json(
        { error: 'Authorization code and code verifier are required' },
        { status: 400 }
      );
    }

    const clientId = process.env.TWITTER_CLIENT_ID;
    const redirectUri = process.env.TWITTER_TOKEN_REDIRECT_URI || 'http://localhost:3000/get-tokens/twitter/callback';

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Twitter token exchange error:', tokenData);
      return NextResponse.json(
        { error: tokenData.error_description || tokenData.error || 'Failed to exchange token' },
        { status: tokenResponse.status }
      );
    }

    return NextResponse.json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      refresh_token: tokenData.refresh_token,
    });
  } catch (error) {
    console.error('Error exchanging Twitter token:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
