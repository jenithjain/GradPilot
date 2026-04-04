import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(session.user.id)
      .select('+socialTokens.linkedin.access_token +socialTokens.twitter.access_token')
      .lean();

    const linkedin = !!(user?.socialTokens?.linkedin?.access_token);
    const twitter = !!(user?.socialTokens?.twitter?.access_token);

    return NextResponse.json({ linkedin, twitter });
  } catch (error) {
    console.error('Error checking social status:', error);
    return NextResponse.json({ error: 'Failed to check social status' }, { status: 500 });
  }
}
