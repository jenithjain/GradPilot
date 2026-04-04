import { NextResponse } from 'next/server';

export async function GET() {
  const credentials = {
    TWITTER_API_KEY: process.env.TWITTER_API_KEY ? 'Set (length: ' + process.env.TWITTER_API_KEY.length + ')' : 'Missing',
    TWITTER_API_SECRET: process.env.TWITTER_API_SECRET ? 'Set (length: ' + process.env.TWITTER_API_SECRET.length + ')' : 'Missing',
    TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN ? 'Set (length: ' + process.env.TWITTER_ACCESS_TOKEN.length + ')' : 'Missing',
    TWITTER_ACCESS_TOKEN_SECRET: process.env.TWITTER_ACCESS_TOKEN_SECRET ? 'Set (length: ' + process.env.TWITTER_ACCESS_TOKEN_SECRET.length + ')' : 'Missing',
  };

  return NextResponse.json({
    message: 'Twitter credentials status',
    credentials,
    apiKeyStart: process.env.TWITTER_API_KEY?.substring(0, 10) + '...',
    accessTokenStart: process.env.TWITTER_ACCESS_TOKEN?.substring(0, 20) + '...',
  });
}
