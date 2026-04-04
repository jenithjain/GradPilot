import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import ConversationMemory from '@/lib/models/ConversationMemory';
import {
  buildCounsellingProgress,
  buildCounsellingSnapshot,
} from '@/lib/counselling-profile';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to continue.' },
        { status: 401 }
      );
    }

    const kycData = await request.json();
    
    // Validate required fields
    if (!kycData || typeof kycData !== 'object') {
      return NextResponse.json(
        { error: 'Invalid KYC data provided' },
        { status: 400 }
      );
    }

    // Required fields validation - matching the student onboarding form
    const requiredFields = [
      'educationLevel', 'fieldOfStudy', 'institution',
      'gpaPercentage', 'testStatus', 'testScore',
      'targetCountries', 'courseInterest',
      'intakeTiming', 'applicationTimeline',
      'budgetRange', 'scholarshipInterest',
      'primaryObjective', 'painPoints',
      'documentType'
    ];
    const missingFields = requiredFields.filter(field => {
      const value = kycData[field];
      return !value || (Array.isArray(value) && value.length === 0);
    });
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    await dbConnect();
    
    // Check if user exists
    const existingUser = await User.findById(session.user.id);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if KYC already completed
    if (existingUser.hasCompletedKYC) {
      return NextResponse.json(
        { error: 'KYC already completed for this account' },
        { status: 400 }
      );
    }

    // Update user with KYC data
    const user = await User.findByIdAndUpdate(
      session.user.id,
      {
        studentProfile: {
          ...kycData,
          submittedAt: new Date()
        },
        hasCompletedKYC: true,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    return NextResponse.json({
      success: true,
      message: 'KYC completed successfully',
      hasCompletedKYC: true
    });

  } catch (error) {
    console.error('KYC submission error:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return NextResponse.json(
        { error: `Validation failed: ${errors.join(', ')}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit KYC data. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const [user, latestConversation] = await Promise.all([
      User.findById(session.user.id).select('studentProfile hasCompletedKYC updatedAt'),
      ConversationMemory.findOne({ userId: session.user.id, mode: 'onboarding' })
        .sort({ createdAt: -1 })
        .select('conversationId summary extractedFacts callDurationSecs createdAt messages')
        .lean(),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const studentProfile = user.studentProfile?.toObject?.() || user.studentProfile || {};
    const counsellingProgress = buildCounsellingProgress(studentProfile);

    return NextResponse.json({
      hasCompletedKYC: user.hasCompletedKYC,
      studentProfile,
      counsellingProfile: buildCounsellingSnapshot(studentProfile),
      counsellingProgress,
      latestConversation: serializeConversation(latestConversation),
    });

  } catch (error) {
    console.error('KYC fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KYC data' },
      { status: 500 }
    );
  }
}

// PUT endpoint to save progress without completing KYC
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to continue.' },
        { status: 401 }
      );
    }

    const kycData = await request.json();
    
    if (!kycData || typeof kycData !== 'object') {
      return NextResponse.json(
        { error: 'Invalid KYC data provided' },
        { status: 400 }
      );
    }

    await dbConnect();
    
    const existingUser = await User.findById(session.user.id);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Save progress — merge with existing data
    const merged = {
      ...(existingUser.studentProfile?.toObject?.() || {}),
      ...kycData
    };

    const counsellingProgress = buildCounsellingProgress(merged);
    const isNowComplete = existingUser.hasCompletedKYC || counsellingProgress.isComplete;

    const user = await User.findByIdAndUpdate(
      session.user.id,
      {
        studentProfile: merged,
        hasCompletedKYC: isNowComplete,
        updatedAt: new Date()
      },
      { new: true, runValidators: false }
    );

    return NextResponse.json({
      success: true,
      message: 'Progress saved successfully',
      studentProfile: user.studentProfile,
      hasCompletedKYC: user.hasCompletedKYC,
      counsellingProgress,
    });

  } catch (error) {
    console.error('KYC save progress error:', error);
    return NextResponse.json(
      { error: 'Failed to save progress. Please try again.' },
      { status: 500 }
    );
  }
}

function serializeConversation(conversation) {
  if (!conversation) return null;

  const extractedFacts = conversation.extractedFacts instanceof Map
    ? Object.fromEntries(conversation.extractedFacts)
    : (conversation.extractedFacts || {});

  return {
    conversationId: conversation.conversationId,
    summary: conversation.summary || '',
    extractedFacts,
    callDurationSecs: conversation.callDurationSecs || 0,
    createdAt: conversation.createdAt,
    messages: Array.isArray(conversation.messages)
      ? conversation.messages.map((message) => ({
          role: message.role,
          message: message.message || '',
          timeInCallSecs: message.timeInCallSecs || 0,
        }))
      : [],
  };
}
