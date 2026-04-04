import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import ConversationMemory from '@/lib/models/ConversationMemory';
import User from '@/lib/models/User';
import {
  COUNSELLING_FIELDS,
  buildCounsellingProgress,
  buildCounsellingSnapshot,
  isMeaningfulCounsellingValue,
} from '@/lib/counselling-profile';

const FIELD_LABELS = Object.fromEntries(
  COUNSELLING_FIELDS.map((field) => [field.key, field.label])
);

const RESUME_MODES = new Set(['fresh', 'resume-focused', 'fast-finish']);

/**
 * GET /api/voice-agent/memory
 * Builds a complete context string from:
 *  - Student profile (KYC data)
 *  - Past conversation summaries & extracted facts
 * This gets injected into the ElevenLabs agent prompt as dynamic variables.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const prepareResume = url.searchParams.get('prepareResume') === '1';

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

    const studentProfile = user.studentProfile || {};
    const counsellingProgress = buildCounsellingProgress(studentProfile);

    // Build profile context
    const profileContext = buildProfileContext(user.name, studentProfile);

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

    const fallbackResumePlan = buildFallbackResumePlan({
      studentName: buildCounsellingSnapshot(studentProfile).studentName || user.name,
      counsellingProgress,
      allFacts,
    });

    const resumePlan = prepareResume
      ? await buildResumePlan({
          studentName: buildCounsellingSnapshot(studentProfile).studentName || user.name,
          counsellingProgress,
          profileContext,
          memoryContext,
          allFacts,
          fallbackResumePlan,
        })
      : null;

    // Build the full context prompt
    const fullContext = buildFullContext({
      profileContext,
      memoryContext,
      allFacts,
      counsellingProgress,
      resumePlan,
    });

    return NextResponse.json({
      context: fullContext,
      studentName: buildCounsellingSnapshot(studentProfile).studentName || user.name,
      hasProfile: counsellingProgress.filledCount > 0,
      conversationCount: conversations.length,
      facts: allFacts,
      counsellingProgress,
      resumePlan: resumePlan || fallbackResumePlan,
    });
  } catch (error) {
    console.error('[memory] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function buildProfileContext(userName, studentProfile) {
  const snapshot = buildCounsellingSnapshot(studentProfile);
  const lines = [`Name: ${snapshot.studentName || userName}`];

  for (const field of COUNSELLING_FIELDS) {
    if (field.key === 'studentName') continue;

    const value = snapshot[field.key];
    if (!isMeaningfulCounsellingValue(value)) continue;

    lines.push(`${field.label}: ${Array.isArray(value) ? value.join(', ') : value}`);
  }

  return lines.join('\n');
}

function buildMemoryContext(conversations) {
  if (conversations.length === 0) return '';

  return conversations
    .map((conv) => {
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

function buildFullContext({ profileContext, memoryContext, allFacts, counsellingProgress, resumePlan }) {
  const resumeSection = resumePlan
    ? [
        '',
        '## Resume Strategy',
        `Resume Mode: ${resumePlan.resumeMode}`,
        `Skip Generic Opening: ${resumePlan.shouldSkipOpeningSequence ? 'Yes' : 'No'}`,
        `Completion Estimate: ${resumePlan.completionEstimate}%`,
        `Focus Fields: ${resumePlan.focusFields.length > 0 ? resumePlan.focusFields.map((field) => FIELD_LABELS[field] || field).join(', ') : 'None'}`,
        'Agent Guidance:',
        resumePlan.firstTurnGuidance,
        resumePlan.instructionSummary,
      ]
    : [];

  return [
    '## Student Profile',
    profileContext || 'No profile completed yet.',
    '',
    '## KYC Status',
    counsellingProgress.isComplete
      ? 'KYC is COMPLETE. The student has already filled their profile. Do not re-ask questions they have already answered.'
      : counsellingProgress.filledCount > 0
        ? `KYC is PARTIAL — some information was collected in a previous conversation but not everything. Review the profile above and ONLY ask about missing or incomplete fields. Do NOT re-ask information already provided. Missing fields: ${counsellingProgress.missingLabels.join(', ')}.`
        : 'KYC has NOT started yet. Begin collecting information from scratch.',
    '',
    '## Conversation History Summary',
    memoryContext || 'This is the first conversation with this student.',
    '',
    '## Known Facts About This Student',
    Object.keys(allFacts).length > 0
      ? Object.entries(allFacts).map(([key, value]) => `- ${key}: ${value}`).join('\n')
      : 'No facts extracted yet.',
    ...resumeSection,
  ].join('\n');
}

function buildFallbackResumePlan({ studentName, counsellingProgress, allFacts }) {
  const totalCount = counsellingProgress.totalCount || COUNSELLING_FIELDS.length;
  const filledCount = counsellingProgress.filledCount || 0;
  const completionEstimate = Math.round((filledCount / Math.max(totalCount, 1)) * 100);
  const focusFields = counsellingProgress.missingFields.slice(0, 4);
  const returningStudent = filledCount > 0;
  const resumeMode = !returningStudent
    ? 'fresh'
    : focusFields.length <= 2 || completionEstimate >= 80
      ? 'fast-finish'
      : 'resume-focused';

  const knownFactsSummary = Object.keys(allFacts).length > 0
    ? `Already captured facts: ${Object.entries(allFacts)
        .map(([key, value]) => `${FIELD_LABELS[key] || key}: ${value}`)
        .join('; ')}.`
    : 'No reliable facts are stored yet.';

  const firstTurnGuidance = resumeMode === 'fresh'
    ? 'Start with the normal onboarding opening and begin collecting the student profile from scratch.'
    : resumeMode === 'fast-finish'
      ? `This is a returning student. Skip the generic introduction. Briefly acknowledge the previous call, confirm you already have most details, and directly ask only for the remaining fields: ${focusFields.map((field) => FIELD_LABELS[field] || field).join(', ') || 'none'}.`
      : `This is a returning student. Do not restart the full introduction. Briefly acknowledge the previous call and continue directly with the missing fields: ${focusFields.map((field) => FIELD_LABELS[field] || field).join(', ') || 'none'}.`;

  return {
    studentName,
    resumeMode,
    shouldSkipOpeningSequence: resumeMode !== 'fresh',
    focusFields,
    completionEstimate,
    firstTurnGuidance,
    instructionSummary: knownFactsSummary,
    returningStudent,
  };
}

async function buildResumePlan({
  studentName,
  counsellingProgress,
  profileContext,
  memoryContext,
  allFacts,
  fallbackResumePlan,
}) {
  if (!process.env.GEMINI_API_KEY) {
    return fallbackResumePlan;
  }

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are preparing a resumed overseas education counselling voice call.

Return VALID JSON with exactly this shape:
{
  "resumeMode": "fresh | resume-focused | fast-finish",
  "shouldSkipOpeningSequence": true,
  "focusFields": ["applicationTimeline"],
  "completionEstimate": 0,
  "firstTurnGuidance": "",
  "instructionSummary": ""
}

Rules:
- Use only these field keys in focusFields: ${COUNSELLING_FIELDS.map((field) => field.key).join(', ')}
- If the student already has most fields captured, use "fast-finish".
- If the student has some history but several fields are still missing, use "resume-focused".
- Use "fresh" only when there is effectively no useful prior data.
- shouldSkipOpeningSequence must be true for returning students.
- firstTurnGuidance must tell the agent exactly how to open the next turn without wasting time.
- instructionSummary must be concise and mention the strongest known facts or remaining gaps.
- Never tell the agent to re-ask already captured fields.

Student name: ${studentName || 'Unknown'}
Filled fields: ${counsellingProgress.filledCount}/${counsellingProgress.totalCount}
Missing fields: ${counsellingProgress.missingFields.join(', ') || 'none'}

Student profile:
${profileContext || 'No saved profile.'}

Saved conversation summaries:
${memoryContext || 'No prior calls.'}

Known facts:
${Object.keys(allFacts).length > 0 ? JSON.stringify(allFacts, null, 2) : 'None'}

Respond ONLY with valid JSON.`;

  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();
    const parsed = JSON.parse(rawText.replace(/```json\n?|\n?```/g, ''));
    return sanitizeResumePlan(parsed, fallbackResumePlan, counsellingProgress);
  } catch (error) {
    console.warn('[memory] Resume plan fallback:', error.message);
    return fallbackResumePlan;
  }
}

function sanitizeResumePlan(plan, fallbackResumePlan, counsellingProgress) {
  const resumeMode = RESUME_MODES.has(plan?.resumeMode)
    ? plan.resumeMode
    : fallbackResumePlan.resumeMode;

  const focusFields = Array.isArray(plan?.focusFields)
    ? plan.focusFields.filter((field) => counsellingProgress.missingFields.includes(field))
    : [];

  return {
    ...fallbackResumePlan,
    resumeMode,
    shouldSkipOpeningSequence: typeof plan?.shouldSkipOpeningSequence === 'boolean'
      ? plan.shouldSkipOpeningSequence
      : fallbackResumePlan.shouldSkipOpeningSequence,
    focusFields: focusFields.length > 0 ? focusFields : fallbackResumePlan.focusFields,
    completionEstimate: Number.isFinite(plan?.completionEstimate)
      ? Math.max(0, Math.min(100, Math.round(plan.completionEstimate)))
      : fallbackResumePlan.completionEstimate,
    firstTurnGuidance: typeof plan?.firstTurnGuidance === 'string' && plan.firstTurnGuidance.trim()
      ? plan.firstTurnGuidance.trim()
      : fallbackResumePlan.firstTurnGuidance,
    instructionSummary: typeof plan?.instructionSummary === 'string' && plan.instructionSummary.trim()
      ? plan.instructionSummary.trim()
      : fallbackResumePlan.instructionSummary,
  };
}
