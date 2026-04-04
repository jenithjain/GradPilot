import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';

/**
 * GET /api/user/predictions
 * Fetch all prediction logs for the authenticated user
 */
export async function GET(request) {
  try {
    // Get authenticated user session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Connect to MongoDB
    await connectDB();

    // Get limit from query params (default: 20)
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    // Fetch user with prediction logs
    const user = await User.findOne(
      { email: session.user.email },
      { 
        predictionLogs: { $slice: -limit }, // Get last N predictions
        email: 1 
      }
    ).lean();

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Sort predictions by createdAt (newest first)
    const predictions = (user.predictionLogs || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({
      user_email: user.email,
      total_predictions: predictions.length,
      predictions: predictions
    });

  } catch (error) {
    console.error('Error fetching predictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions', details: error.message },
      { status: 500 }
    );
  }
}
