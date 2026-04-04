import { NextResponse } from 'next/server';

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_REDIRECT_URI = process.env.NEXT_PUBLIC_TWITTER_REDIRECT_URI || 'http://localhost:3000/api/twitter/auth/callback';

export async function GET() {
  // Step 1: Redirect user to Twitter OAuth 2.0
  const state = Math.random().toString(36).substring(2, 15); // Store in session for CSRF
  const code_challenge = state; // For demo, use state as code_challenge (use PKCE in production)
  const scope = 'tweet.read tweet.write users.read offline.access';
  const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${TWITTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(TWITTER_REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&state=${state}&code_challenge=${code_challenge}&code_challenge_method=plain`;
  return NextResponse.redirect(authUrl);
}
