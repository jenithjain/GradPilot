import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

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
    
    const user = await User.findById(session.user.id).select('studentProfile hasCompletedKYC');

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      hasCompletedKYC: user.hasCompletedKYC,
      studentProfile: user.studentProfile
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
      ...existingUser.studentProfile?.toObject?.() || {},
      ...kycData
    };

    // Check if profile is now complete (≥5 of 6 core fields filled)
    const coreFields = ['educationLevel', 'fieldOfStudy', 'targetCountries', 'courseInterest', 'budgetRange', 'testStatus'];
    const filledCore = coreFields.filter((f) => {
      const v = merged[f];
      if (v === null || v === undefined) return false;
      if (Array.isArray(v)) return v.length > 0;
      return typeof v === 'string' && v.trim() !== '';
    }).length;
    const isNowComplete = filledCore >= 5;

    const user = await User.findByIdAndUpdate(
      session.user.id,
      {
        studentProfile: merged,
        ...(isNowComplete ? { hasCompletedKYC: true } : {}),
        updatedAt: new Date()
      },
      { new: true, runValidators: false }
    );

    return NextResponse.json({
      success: true,
      message: 'Progress saved successfully',
      studentProfile: user.studentProfile,
      hasCompletedKYC: user.hasCompletedKYC,
    });

  } catch (error) {
    console.error('KYC save progress error:', error);
    return NextResponse.json(
      { error: 'Failed to save progress. Please try again.' },
      { status: 500 }
    );
  }
}
