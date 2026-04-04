import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';

/**
 * GET /api/user/prediction/:predictionId
 * Returns a single prediction log for the authenticated user.
 */
export async function GET(_request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findOne({ email: session.user.email }, { predictionLogs: 1 }).lean();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Await params in Next.js 15
    const { predictionId } = await params;
    const prediction = (user.predictionLogs || []).find(p => p.predictionId === predictionId);
    if (!prediction) {
      return NextResponse.json({ error: 'Prediction not found' }, { status: 404 });
    }

    return NextResponse.json({ prediction });
  } catch (err) {
    console.error('Error fetching prediction:', err);
    return NextResponse.json({ error: 'Failed to fetch prediction', details: err.message }, { status: 500 });
  }
}
