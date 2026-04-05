import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import CounsellorSession from '@/lib/models/CounsellorSession';
import User from '@/lib/models/User';
import { getFlashModel } from '@/lib/gemini';
import { sendWhatsAppMessage } from '@/lib/whatsapp/sendMessage';

function normalizeRole(value) {
  const v = String(value || '').toLowerCase();
  if (['user', 'student', 'human', 'caller'].includes(v)) return 'user';
  if (['assistant', 'ai', 'bot', 'agent', 'counsellor'].includes(v)) return 'assistant';
  if (['system'].includes(v)) return 'system';
  return 'unknown';
}

function pushIfValid(list, role, text, meta, timestamp) {
  const cleanText = typeof text === 'string' ? text.trim() : '';
  if (!cleanText) return;
  list.push({
    role: normalizeRole(role),
    text: cleanText,
    meta: meta || null,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
  });
}

function extractTranscriptEntries(payload) {
  const out = [];
  if (!payload || typeof payload !== 'object') return out;

  const ts = payload.timestamp || payload.time || payload.createdAt;

  if (Array.isArray(payload.transcript)) {
    for (const item of payload.transcript) {
      if (!item || typeof item !== 'object') continue;
      pushIfValid(
        out,
        item.role || item.speaker || item.type,
        item.text || item.message || item.content,
        item,
        item.timestamp || item.time || ts
      );
    }
  }

  pushIfValid(out, payload.role || payload.speaker || payload.type, payload.text, payload, ts);
  pushIfValid(out, payload.role || 'user', payload.userText, payload, ts);
  pushIfValid(out, payload.role || 'assistant', payload.assistantText, payload, ts);
  pushIfValid(out, payload.role || payload.speaker, payload.message, payload, ts);

  if (payload.event && typeof payload.event === 'object') {
    pushIfValid(
      out,
      payload.event.role || payload.event.speaker || payload.role,
      payload.event.text || payload.event.message || payload.event.content,
      payload.event,
      payload.event.timestamp || ts
    );
  }

  return out;
}

async function getAuthorizedSessionDoc(session, sessionId) {
  const doc = await CounsellorSession.findById(sessionId);
  if (!doc) return { error: NextResponse.json({ error: 'Session not found' }, { status: 404 }) };

  if (session.user.role === 'counsellor') {
    return { doc };
  }

  if (String(doc.userId) !== String(session.user.id)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { doc };
}

export async function GET(_request, { params }) {
  try {
    const { sessionId } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { doc, error } = await getAuthorizedSessionDoc(session, sessionId);
    if (error) return error;

    return NextResponse.json({
      session: {
        id: String(doc._id),
        userId: String(doc.userId),
        provider: doc.provider,
        embedId: doc.embedId,
        status: doc.status,
        title: doc.title,
        startedAt: doc.startedAt,
        endedAt: doc.endedAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        transcript: doc.transcript || [],
        rawEvents: doc.rawEvents || [],
      },
    });
  } catch (error) {
    console.error('[counsellor-sessions/:id] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { sessionId } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { doc, error } = await getAuthorizedSessionDoc(session, sessionId);
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const events = Array.isArray(body.events) ? body.events : (body.event ? [body.event] : []);

    if (events.length === 0) {
      return NextResponse.json({ error: 'No events provided' }, { status: 400 });
    }

    const now = new Date();
    for (const event of events) {
      if (!event || typeof event !== 'object') continue;

      doc.rawEvents.push({
        eventType: event.eventType || event.type || 'message',
        origin: event.origin || '',
        payload: event.payload ?? event,
        timestamp: event.timestamp ? new Date(event.timestamp) : now,
      });

      const transcriptEntries = extractTranscriptEntries(event.payload ?? event);
      if (transcriptEntries.length > 0) {
        for (const entry of transcriptEntries) {
          doc.transcript.push(entry);
        }
      }

      // Fallback: if the frontend extracted readable text, store it directly
      if (transcriptEntries.length === 0 && event.extractedText) {
        const role = event.eventType === 'user_message' || event.eventType === 'user_input'
          ? 'user'
          : event.eventType === 'bot_message' || event.eventType === 'agent_response'
          ? 'assistant'
          : 'unknown';
        doc.transcript.push({
          role,
          text: String(event.extractedText).trim(),
          meta: null,
          timestamp: event.timestamp ? new Date(event.timestamp) : now,
        });
      }
    }

    if (!doc.title && doc.transcript.length > 0) {
      const firstUser = doc.transcript.find((x) => x.role === 'user');
      if (firstUser?.text) {
        doc.title = `Counsellor Session: ${firstUser.text.slice(0, 40)}`;
      }
    }

    doc.lastEventAt = now;
    await doc.save();

    return NextResponse.json({
      success: true,
      transcriptCount: doc.transcript.length,
      rawEventCount: doc.rawEvents.length,
    });
  } catch (error) {
    console.error('[counsellor-sessions/:id] POST error:', error);
    return NextResponse.json({ error: 'Failed to append events' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { sessionId } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { doc, error } = await getAuthorizedSessionDoc(session, sessionId);
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const nextStatus = body.status;

    if (nextStatus && ['active', 'paused', 'completed', 'failed'].includes(nextStatus)) {
      doc.status = nextStatus;
    }

    if (doc.status !== 'active' && doc.status !== 'paused' && !doc.endedAt) {
      doc.endedAt = new Date();
    }

    doc.lastEventAt = new Date();
    await doc.save();

    // When session is completed, generate summary and send WhatsApp
    if (doc.status === 'completed') {
      generateSummaryAndNotify(doc, session.user.id).catch((err) =>
        console.error('[counsellor-session] summary/whatsapp failed:', err)
      );
    }

    return NextResponse.json({
      success: true,
      status: doc.status,
      endedAt: doc.endedAt,
      transcriptCount: doc.transcript.length,
    });
  } catch (error) {
    console.error('[counsellor-sessions/:id] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

async function generateSummaryAndNotify(sessionDoc, userId) {
  // Build conversation text from transcript
  let conversationText = sessionDoc.transcript
    .map((t) => `${t.role}: ${t.text}`)
    .join('\n');

  // Fallback: build from rawEvents if transcript is empty
  if (!conversationText.trim() && sessionDoc.rawEvents.length > 0) {
    const rawTexts = [];
    for (const re of sessionDoc.rawEvents) {
      const payload = re.payload;
      if (!payload || typeof payload !== 'object') continue;
      // Try common text fields
      const text = payload.text || payload.message || payload.content ||
        payload.userText || payload.assistantText ||
        payload.input || payload.output || payload.response;
      if (typeof text === 'string' && text.trim()) {
        rawTexts.push(`${re.eventType}: ${text.trim()}`);
      }
    }
    conversationText = rawTexts.join('\n');
  }

  // If still nothing, create a basic summary
  if (!conversationText.trim()) {
    conversationText = `Session had ${sessionDoc.rawEvents.length} events but no readable text was captured.`;
  }

  // Generate summary + follow-up questions via Gemini
  const model = getFlashModel();
  const prompt = `You are summarizing a student counselling session about studying abroad. Based on the conversation below, provide:
1. A short summary (2-3 sentences max) of the key topics discussed.
2. Exactly 3 follow-up questions the student should consider before their next session.

Conversation:
${conversationText}

Respond ONLY in this JSON format:
{"summary": "...", "followUpQuestions": ["...", "...", "..."]}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  let summary = '';
  let followUpQuestions = [];

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      summary = parsed.summary || '';
      followUpQuestions = Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [];
    }
  } catch {
    summary = responseText.slice(0, 300);
  }

  // Store summary in the session document
  sessionDoc.summary = summary;
  sessionDoc.followUpQuestions = followUpQuestions;
  await sessionDoc.save();

  // Fetch user's phone number from DB
  const user = await User.findById(userId).select('name studentProfile.phoneNumber').lean();
  const phoneNumber = user?.studentProfile?.phoneNumber;

  if (!phoneNumber) {
    console.warn('[counsellor-session] No phone number found for user:', userId, '- skipping WhatsApp notification');
    return;
  }

  // Clean phone number: digits only, add country code if needed
  let cleanPhone = phoneNumber.replace(/[^\d]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone; // Default to India
  }

  // Build WhatsApp message
  const followUpText = followUpQuestions.length > 0
    ? followUpQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    : '';

  const message = `🎓 *GradPilot - Session Summary*\n\n${summary}\n\n📋 *Follow-up Questions:*\n${followUpText}\n\n_Reply to this message if you need further assistance!_`;

  try {
    await sendWhatsAppMessage(cleanPhone, message);
    console.log('[counsellor-session] WhatsApp sent to:', cleanPhone);
  } catch (whatsappErr) {
    console.error('[counsellor-session] WhatsApp send failed:', whatsappErr.message);
  }
}
