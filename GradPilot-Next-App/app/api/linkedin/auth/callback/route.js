import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_REDIRECT_URI = process.env.NEXT_PUBLIC_LINKEDIN_REDIRECT_URI || 'http://localhost:3000/api/linkedin/auth/callback';

export async function GET(req) {
  // Step 2: Handle LinkedIn OAuth callback
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code) {
    return NextResponse.redirect('/profile?error=linkedin_auth_failed');
  }
  // Exchange code for access token
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: LINKEDIN_REDIRECT_URI,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return NextResponse.redirect('/profile?error=linkedin_token_failed');
  }
  
  // Store token in user's account
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      await dbConnect();
      await User.findByIdAndUpdate(session.user.id, {
        'socialTokens.linkedin': {
          access_token: tokenData.access_token,
          expires_in: tokenData.expires_in,
          connected_at: new Date()
        }
      });
    }
  } catch (error) {
    console.error('Error storing LinkedIn token:', error);
  }
  
  return NextResponse.redirect('/profile?linkedin=connected');
}
