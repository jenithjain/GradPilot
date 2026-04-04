import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { code } = await req.json();
    
    console.log('LinkedIn token exchange attempt');
    console.log('Code received:', code ? 'Yes' : 'No');
    console.log('Client ID:', process.env.LINKEDIN_CLIENT_ID);
    console.log('Redirect URI:', 'http://localhost:3000/get-tokens/linkedin/callback');

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: 'http://localhost:3000/get-tokens/linkedin/callback',
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    });

    console.log('Sending request to LinkedIn...');

    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();
    
    console.log('LinkedIn response status:', response.status);
    console.log('LinkedIn response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return NextResponse.json({ 
        error: data.error || 'Failed to exchange token',
        error_description: data.error_description || 'Unknown error',
        details: data,
        status: response.status
      }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in token exchange:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
