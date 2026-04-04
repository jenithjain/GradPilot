import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import CounsellorSession from '@/lib/models/CounsellorSession';

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
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { doc, error } = await getAuthorizedSessionDoc(session, params.sessionId);
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
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { doc, error } = await getAuthorizedSessionDoc(session, params.sessionId);
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
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { doc, error } = await getAuthorizedSessionDoc(session, params.sessionId);
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const nextStatus = body.status;

    if (nextStatus && ['active', 'completed', 'failed'].includes(nextStatus)) {
      doc.status = nextStatus;
    }

    if (doc.status !== 'active' && !doc.endedAt) {
      doc.endedAt = new Date();
    }

    doc.lastEventAt = new Date();
    await doc.save();

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
