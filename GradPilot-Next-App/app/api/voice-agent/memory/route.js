import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import ConversationMemory from '@/lib/models/ConversationMemory';
import User from '@/lib/models/User';

/**
 * GET /api/voice-agent/memory
 * Builds a complete context string from:
 *  - Student profile (KYC data)
 *  - Past conversation summaries & extracted facts
 * This gets injected into the ElevenLabs agent prompt as dynamic variables.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Fetch user profile
    const user = await User.findById(session.user.id).lean();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch past conversations (most recent 15)
    const conversations = await ConversationMemory.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    // Build profile context
    const profileContext = buildProfileContext(user);

    // Build memory context from past conversations
    const memoryContext = buildMemoryContext(conversations);

    // Merge all extracted facts across conversations
    const allFacts = {};
    for (const conv of conversations) {
      if (conv.extractedFacts) {
        const facts = conv.extractedFacts instanceof Map
          ? Object.fromEntries(conv.extractedFacts)
          : conv.extractedFacts;
        Object.assign(allFacts, facts);
      }
    }

    // Build the full context prompt
    const fullContext = [
      `## Student Profile`,
      profileContext || 'No profile completed yet.',
      '',
      `## KYC Status`,
      user.hasCompletedKYC
        ? 'KYC is COMPLETE. The student has already filled their profile. Do not re-ask questions they have already answered.'
        : user.studentProfile
          ? 'KYC is PARTIAL — some information was collected in a previous conversation but not everything. Review the profile above and ONLY ask about missing or incomplete fields. Do NOT re-ask information already provided.'
          : 'KYC has NOT started yet. Begin collecting information from scratch.',
      '',
      `## Conversation History Summary`,
      memoryContext || 'This is the first conversation with this student.',
      '',
      `## Known Facts About This Student`,
      Object.keys(allFacts).length > 0
        ? Object.entries(allFacts).map(([k, v]) => `- ${k}: ${v}`).join('\n')
        : 'No facts extracted yet.',
    ].join('\n');

    return NextResponse.json({
      context: fullContext,
      studentName: user.name,
      hasProfile: !!user.studentProfile,
      conversationCount: conversations.length,
      facts: allFacts,
    });
  } catch (error) {
    console.error('[memory] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function buildProfileContext(user) {
  if (!user.studentProfile) return '';

  const p = user.studentProfile;
  const lines = [
    `Name: ${user.name}`,
    p.educationLevel && `Education Level: ${p.educationLevel}`,
    p.fieldOfStudy && `Field of Study: ${p.fieldOfStudy}`,
    p.institution && `Institution: ${p.institution}`,
    p.gpaPercentage && `GPA/Percentage: ${p.gpaPercentage}`,
    p.testStatus && `Test Status: ${p.testStatus}`,
    p.testScore && `Test Score: ${p.testScore}`,
    p.targetCountries?.length && `Target Countries: ${p.targetCountries.join(', ')}`,
    p.courseInterest && `Course Interest: ${p.courseInterest}`,
    p.intakeTiming && `Intake Timing: ${p.intakeTiming}`,
    p.applicationTimeline && `Application Timeline: ${p.applicationTimeline}`,
    p.budgetRange && `Budget Range: ${p.budgetRange}`,
    p.scholarshipInterest && `Scholarship Interest: ${p.scholarshipInterest}`,
    p.primaryObjective && `Primary Objective: ${p.primaryObjective}`,
    p.painPoints?.length && `Pain Points: ${p.painPoints.join(', ')}`,
  ];
  return lines.filter(Boolean).join('\n');
}

function buildMemoryContext(conversations) {
  if (conversations.length === 0) return '';

  return conversations
    .map((conv, i) => {
      const date = new Date(conv.createdAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const mode = conv.mode === 'onboarding' ? '(Onboarding)' : '(Chat)';
      return `[${date} ${mode}] ${conv.summary || 'No summary available.'}`;
    })
    .join('\n');
}
