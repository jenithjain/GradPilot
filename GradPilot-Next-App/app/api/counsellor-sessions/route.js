import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import CounsellorSession from '@/lib/models/CounsellorSession';

function getEmbedId(embedUrl) {
  if (!embedUrl || typeof embedUrl !== 'string') return '';
  try {
    const url = new URL(embedUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  } catch {
    return '';
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const provider = body.provider || 'liveavatar';
    const embedUrl = body.embedUrl || '';
    const embedId = body.embedId || getEmbedId(embedUrl);

    await dbConnect();

    const doc = await CounsellorSession.create({
      userId: session.user.id,
      provider,
      embedId,
      status: 'active',
      title: 'AI Counsellor Session',
      metadata: {
        embedUrl,
      },
      startedAt: new Date(),
      lastEventAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      sessionId: String(doc._id),
      status: doc.status,
      startedAt: doc.startedAt,
    });
  } catch (error) {
    console.error('[counsellor-sessions] POST error:', error);
    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    const query = session.user.role === 'counsellor'
      ? {}
      : { userId: session.user.id };

    const sessions = await CounsellorSession.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('userId provider embedId status title startedAt endedAt lastEventAt createdAt transcript')
      .lean();

    const serialized = sessions.map((s) => ({
      id: String(s._id),
      userId: String(s.userId),
      provider: s.provider,
      embedId: s.embedId,
      status: s.status,
      title: s.title,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      lastEventAt: s.lastEventAt,
      createdAt: s.createdAt,
      transcriptCount: Array.isArray(s.transcript) ? s.transcript.length : 0,
      preview: Array.isArray(s.transcript)
        ? s.transcript.slice(-5).map((x) => ({ role: x.role, text: x.text, timestamp: x.timestamp }))
        : [],
    }));

    return NextResponse.json({ sessions: serialized });
  } catch (error) {
    console.error('[counsellor-sessions] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
