import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import ConversationMemory from '@/lib/models/ConversationMemory';
import {
  buildCounsellingFactMap,
  buildCounsellingProgress,
  mergeCounsellingProfile,
  normalizeCounsellingProfilePatch,
} from '@/lib/counselling-profile';

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

    const body = await request.json();
    const conversationId = body.conversationId || await resolveLatestConversationId();
    if (!conversationId) {
      return NextResponse.json({ error: 'Could not determine conversation to extract' }, { status: 400 });
    }

    // 1. Fetch transcript from ElevenLabs
    const elResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
      { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }
    );

    if (!elResponse.ok) {
      console.error('[extract-kyc] ElevenLabs API error:', elResponse.status);
      return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 502 });
    }

    const elData = await elResponse.json();
    const transcriptEntries = (elData.transcript || [])
      .filter((t) => t.role !== 'tool')
    const transcript = transcriptEntries
      .map((t) => `${t.role === 'user' ? 'Student' : 'Agent'}: ${t.message || ''}`)
      .join('\n');

    if (!transcript.trim()) {
      return NextResponse.json({ success: true, partial: true, message: 'Conversation saved (no data to extract)' });
    }

    // 2. Use Gemini to extract structured counselling data
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a precise extraction engine for an overseas education counselling call.

Extract ONLY the student facts that were explicitly stated by the student in the transcript.
Do not infer, guess, or copy the agent's suggestions as if they were the student's answers.
If the student has not actually provided a value yet, leave it null.

Return VALID JSON matching this template exactly:
${EXTRACTION_TEMPLATE}

Rules:
- Keep strings concise and human-readable.
- Use the student's wording when possible, but lightly normalize obvious formatting.
- targetCountries must be an array of country names mentioned by the student.
- phoneNumber must contain the phone number only if the student explicitly said it.
- contactEmail must contain the email only if the student explicitly said it.
- englishTestStatus should combine status and score if both are known, for example: "IELTS taken, overall 7.0" or "PTE preparing".
- applicationTimeline should capture when the student plans to apply, for example: "next 2 months" or "Fall 2026".
- budgetRange should capture the spoken budget naturally, for example: "20-25 lakhs".
- Do not output placeholder strings like "unknown" or "not provided". Use null instead.

Transcript:
${transcript}

Respond ONLY with valid JSON.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    let extracted;
    try {
      extracted = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch {
      console.error('[extract-kyc] Gemini returned invalid JSON:', text);
      return NextResponse.json({ error: 'Failed to parse extracted profile' }, { status: 500 });
    }

    const profilePatch = normalizeCounsellingProfilePatch(extracted);
    const extractedCount = Object.keys(profilePatch).length;

    // 4. Save to MongoDB
    await dbConnect();

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existingProfile = user.studentProfile?.toObject?.() || {};
    const { mergedProfile } = mergeCounsellingProfile(existingProfile, profilePatch);
    const counsellingProgress = buildCounsellingProgress(mergedProfile);
    const isComplete = user.hasCompletedKYC || counsellingProgress.isComplete;

    await User.findByIdAndUpdate(
      session.user.id,
      {
        studentProfile: mergedProfile,
        hasCompletedKYC: isComplete,
        updatedAt: new Date(),
      },
      { new: true, runValidators: false }
    );

    // Save transcript to ConversationMemory so future sessions have context.
    // This avoids a separate /api/voice-agent/conversations fetch (which would
    // call the ElevenLabs transcript endpoint a second time for the same convo).
    try {
      const rawMessages = (elData.transcript || []).map((t) => ({
        role: t.role === 'agent' ? 'agent' : t.role === 'tool' ? 'tool' : 'user',
        message: t.message || '',
        timeInCallSecs: t.time_in_call_secs || 0,
      }));

      const kycFacts = buildCounsellingFactMap(mergedProfile);

      const profileLine = Object.entries(kycFacts)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');

      const summary = elData.analysis?.transcript_summary
        || `Counselling onboarding — ${
          counsellingProgress.isComplete ? 'all required counselling fields were collected' : 'partial counselling profile collected'
        }. ${profileLine}`.trim();

      await ConversationMemory.findOneAndUpdate(
        { conversationId },
        {
          userId: session.user.id,
          conversationId,
          agentId: elData.agent_id,
          messages: rawMessages,
          summary,
          extractedFacts: kycFacts,
          callDurationSecs: elData.metadata?.call_duration_secs || 0,
          mode: 'onboarding',
        },
        { upsert: true, new: true }
      );
    } catch (memErr) {
      // Non-fatal: KYC data is already saved; memory save failure is acceptable.
      console.warn('[extract-kyc] ConversationMemory save failed:', memErr.message);
    }

    return NextResponse.json({
      success: true,
      partial: !counsellingProgress.isComplete,
      message: counsellingProgress.isComplete
        ? 'Profile extracted and saved from the voice conversation'
        : 'Partial profile saved — continue the conversation to complete the remaining fields',
      profile: mergedProfile,
      extractedFields: extractedCount,
      counsellingProgress,
    });
  } catch (error) {
    console.error('[extract-kyc] Error:', error);
    return NextResponse.json(
      { error: 'Failed to extract and save profile' },
      { status: 500 }
    );
  }
}

async function resolveLatestConversationId() {
  try {
    const listUrl = new URL('https://api.elevenlabs.io/v1/convai/conversations');
    listUrl.searchParams.set('agent_id', process.env.ELEVENLABS_AGENT_ID || 'agent_6301kncrnakkft1seqw159q12j6b');
    listUrl.searchParams.set('page_size', '1');

    const response = await fetch(listUrl.toString(), {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data?.conversations?.[0]?.conversation_id || null;
  } catch {
    return null;
  }
}
