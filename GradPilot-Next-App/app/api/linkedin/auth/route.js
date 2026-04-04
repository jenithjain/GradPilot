import { NextResponse } from 'next/server';

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_REDIRECT_URI = process.env.NEXT_PUBLIC_LINKEDIN_REDIRECT_URI || 'http://localhost:3000/api/linkedin/auth/callback';

export async function GET() {
  // Step 1: Redirect user to LinkedIn OAuth
  const state = Math.random().toString(36).substring(2, 15); // You should store this in session for CSRF protection
  const scope = 'r_liteprofile r_emailaddress w_member_social';
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&state=${state}&scope=${encodeURIComponent(scope)}`;
  return NextResponse.redirect(authUrl);
}
