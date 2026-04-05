import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import CounsellorSession from '@/lib/models/CounsellorSession';
import {
  COUNSELLING_FIELDS,
  buildCounsellingProgress,
  buildCounsellingSnapshot,
  isMeaningfulCounsellingValue,
} from '@/lib/counselling-profile';

/**
 * GET /api/counsellor-sessions/context
 * Returns the student's profile + past session summaries so the
 * LiveAvatar counsellor can have a context-aware conversation.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const [user, pastSessions] = await Promise.all([
      User.findById(session.user.id).lean(),
      CounsellorSession.find({ userId: session.user.id, status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('title summary followUpQuestions transcript startedAt endedAt')
        .lean(),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const studentProfile = user.studentProfile || {};
    const snapshot = buildCounsellingSnapshot(studentProfile);
    const progress = buildCounsellingProgress(studentProfile);

    // Build profile lines
    const profileLines = [`Name: ${snapshot.studentName || user.name}`];
    for (const field of COUNSELLING_FIELDS) {
      if (field.key === 'studentName') continue;
      const value = snapshot[field.key];
      if (!isMeaningfulCounsellingValue(value)) continue;
      profileLines.push(`${field.label}: ${Array.isArray(value) ? value.join(', ') : value}`);
    }

    // Build past session summaries
    const sessionHistory = pastSessions.map((s) => {
      const date = new Date(s.startedAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      });

      // Extract key topics from transcript if no summary exists
      const summary = s.summary || extractQuickSummary(s.transcript);
      const followUps = s.followUpQuestions || [];

      return { date, title: s.title, summary, followUps };
    });

    // Build the full system prompt context
    const contextPrompt = buildContextPrompt({
      profileLines,
      progress,
      sessionHistory,
      studentName: snapshot.studentName || user.name,
    });

    return NextResponse.json({
      contextPrompt,
      studentName: snapshot.studentName || user.name,
      hasProfile: progress.filledCount > 0,
      kycComplete: progress.isComplete,
      pastSessionCount: pastSessions.length,
    });
  } catch (error) {
    console.error('[counsellor-sessions/context] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function extractQuickSummary(transcript) {
  if (!Array.isArray(transcript) || transcript.length === 0) return 'No details recorded.';
  const userMsgs = transcript.filter((t) => t.role === 'user').slice(0, 5);
  if (userMsgs.length === 0) return 'No student messages recorded.';
  return 'Topics discussed: ' + userMsgs.map((m) => m.text.slice(0, 60)).join('; ');
}

function buildContextPrompt({ profileLines, progress, sessionHistory, studentName }) {
  const sections = [];

  // Identity
  sections.push(
    `You are an expert study-abroad counsellor speaking with ${studentName}.`,
    'Use the information below to personalise the conversation. Never re-ask questions the student has already answered.',
    ''
  );

  // Student profile
  sections.push('## Student Profile');
  sections.push(profileLines.join('\n'));
  sections.push('');

  // KYC status
  sections.push('## KYC Status');
  if (progress.isComplete) {
    sections.push('Profile is COMPLETE. Focus on actionable guidance — university recommendations, visa strategy, timelines.');
  } else if (progress.filledCount > 0) {
    sections.push(`Profile is PARTIAL (${progress.filledCount}/${progress.totalCount} fields filled).`);
    sections.push(`Missing fields: ${progress.missingLabels.join(', ')}.`);
    sections.push('You may naturally weave in questions about the missing fields during the conversation.');
  } else {
    sections.push('No profile data yet. Help the student while gently collecting basic information.');
  }
  sections.push('');

  // Past sessions
  sections.push('## Past Counselling Sessions');
  if (sessionHistory.length === 0) {
    sections.push('This is the first session with this student.');
  } else {
    for (const s of sessionHistory) {
      sections.push(`[${s.date}] ${s.title || 'Session'}`);
      sections.push(`  Summary: ${s.summary}`);
      if (s.followUps.length > 0) {
        sections.push(`  Follow-ups given: ${s.followUps.join(' | ')}`);
      }
    }
  }
  sections.push('');

  // Instructions
  sections.push('## Conversation Guidelines');
  sections.push('- Reference past sessions naturally ("Last time we discussed...").');
  sections.push('- If follow-up questions were given previously, ask whether the student has thought about them.');
  sections.push('- Be warm, professional, and concise.');
  sections.push('- Provide actionable next steps at the end of each topic.');

  return sections.join('\n');
}
