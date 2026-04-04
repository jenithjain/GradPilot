import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import {
  buildCounsellingFactMap,
  buildCounsellingProgress,
  mergeCounsellingProfile,
  normalizeCounsellingProfilePatch,
} from '@/lib/counselling-profile';
import ConversationMemory from '@/lib/models/ConversationMemory';

/**
 * POST /api/voice-agent/live-extract
 *
 * Called periodically (~20 s) DURING an active voice call to keep the
 * LiveKYCChecklist updated in real-time.
 *
 * Flow:
 *   1. Fetch current transcript from ElevenLabs (works for active conversations)
 *   2. Run a lightweight Gemini extraction to detect field values
 *   3. Merge newly detected fields into the user's studentProfile
 *   4. Does NOT set hasCompletedKYC — that's reserved for final extraction
 */

const EXTRACTION_TEMPLATE = `{
  "studentName": null,
  "phoneNumber": null,
  "contactEmail": null,
  "currentLocation": null,
  "educationLevel": null,
  "fieldOfStudy": null,
  "institution": null,
  "gpaPercentage": null,
  "targetCountries": [],
  "courseInterest": null,
  "englishTestStatus": null,
  "budgetRange": null,
  "applicationTimeline": null
}`;

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId, lastLineCount } = await request.json();

    const resolvedConversationId = conversationId || await resolveLatestConversationId();
    if (!resolvedConversationId) {
      return NextResponse.json({ fields: [], lineCount: 0, waiting: true });
    }

    // 1. Fetch current transcript from ElevenLabs
    const elResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(resolvedConversationId)}`,
      { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }
    );

    if (!elResponse.ok) {
      // Transcript may not be available yet — not an error
      return NextResponse.json({ fields: [], lineCount: 0, conversationId: resolvedConversationId });
    }

    const elData = await elResponse.json();
    const rawTranscript = (elData.transcript || []).filter((t) => t.role !== 'tool');

    // Skip if transcript hasn't grown since last extraction
    if (rawTranscript.length <= (lastLineCount || 0)) {
      return NextResponse.json({
        fields: [],
        lineCount: rawTranscript.length,
        skipped: true,
        conversationId: resolvedConversationId,
      });
    }

    const transcript = rawTranscript
      .map((t) => `${t.role === 'user' ? 'Student' : 'Agent'}: ${t.message || ''}`)
      .join('\n');

    if (!transcript.trim()) {
      return NextResponse.json({ fields: [], lineCount: 0, conversationId: resolvedConversationId });
    }

    // 2. Lightweight Gemini extraction
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are extracting structured student facts from an ongoing overseas education counselling call.

  Return VALID JSON matching this template exactly:
  ${EXTRACTION_TEMPLATE}

  Rules:
  - Extract ONLY facts the student has explicitly said so far.
  - Do not infer or guess missing answers.
  - Use null for fields that have not been provided yet.
  - targetCountries must be an array.
  - Keep values concise and human-readable.
  - englishTestStatus should combine exam status and score if both are known.
  - Do not output placeholder text like "unknown" or "not provided".

  Transcript:
  ${transcript}

  Respond ONLY with valid JSON.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    let extracted;
    try {
      extracted = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch {
      return NextResponse.json({ fields: [], lineCount: rawTranscript.length, error: 'parse' });
    }

    const validFields = normalizeCounsellingProfilePatch(extracted);

    // 4. Merge into existing profile and persist the live conversation snapshot
    await dbConnect();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ fields: [], lineCount: rawTranscript.length, conversationId: resolvedConversationId });
    }

    const existing = user.studentProfile?.toObject?.() || {};
    const { mergedProfile, changedFields, newFields } = mergeCounsellingProfile(existing, validFields);

    if (changedFields.length > 0) {
      await User.findByIdAndUpdate(session.user.id, {
        $set: {
          studentProfile: mergedProfile,
          updatedAt: new Date(),
        },
      }, { runValidators: false });
    }

    const rawMessages = (elData.transcript || []).map((entry) => ({
      role: entry.role === 'agent' ? 'agent' : entry.role === 'tool' ? 'tool' : 'user',
      message: entry.message || '',
      timeInCallSecs: entry.time_in_call_secs || 0,
    }));

    const liveProfile = changedFields.length > 0 ? mergedProfile : existing;
    const counsellingProgress = buildCounsellingProgress(liveProfile);
    const extractedFacts = buildCounsellingFactMap(liveProfile);
    const summary = `Live counselling capture — ${counsellingProgress.filledCount}/${counsellingProgress.totalCount} fields recorded.`;

    await ConversationMemory.findOneAndUpdate(
      { conversationId: resolvedConversationId },
      {
        userId: session.user.id,
        conversationId: resolvedConversationId,
        agentId: elData.agent_id,
        messages: rawMessages,
        summary,
        extractedFacts,
        callDurationSecs: elData.metadata?.call_duration_secs || 0,
        mode: 'onboarding',
      },
      { upsert: true, new: true }
    );


    return NextResponse.json({
      fields: Object.keys(validFields),
      newFields,
      changedFields,
      lineCount: rawTranscript.length,
      counsellingProgress,
      transcriptUpdated: true,
      conversationId: resolvedConversationId,
    });
  } catch (error) {
    console.error('[live-extract] Error:', error);
    // Non-fatal — return empty fields so the interval continues
    return NextResponse.json({ fields: [], lineCount: 0 });
  }
}

async function resolveLatestConversationId() {
  const listUrl = new URL('https://api.elevenlabs.io/v1/convai/conversations');
  listUrl.searchParams.set('agent_id', process.env.ELEVENLABS_AGENT_ID || 'agent_6301kncrnakkft1seqw159q12j6b');
  listUrl.searchParams.set('page_size', '1');

  const response = await fetch(listUrl.toString(), {
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data?.conversations?.[0]?.conversation_id || null;
}
