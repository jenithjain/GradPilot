import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileData } = await request.json();
    if (!profileData || typeof profileData !== 'object') {
      return NextResponse.json({ error: 'Invalid profile data' }, { status: 400 });
    }

    await dbConnect();

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.hasCompletedKYC) {
      return NextResponse.json({ error: 'KYC already completed' }, { status: 400 });
    }

    await User.findByIdAndUpdate(
      session.user.id,
      {
        studentProfile: {
          ...profileData,
          submittedVia: 'elevenlabs-voice-agent',
          submittedAt: new Date(),
        },
        hasCompletedKYC: true,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    return NextResponse.json({ success: true, message: 'Profile saved via voice agent' });
  } catch (error) {
    console.error('[submit-kyc-elevenlabs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save profile. Please try again.' },
      { status: 500 }
    );
  }
}
