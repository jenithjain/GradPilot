import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import ConversationMemory from '@/lib/models/ConversationMemory';

/**
 * POST /api/voice-agent/conversations/sync-latest
 * Fetches the most recent conversation from ElevenLabs API and saves it to MongoDB.
 * Falls back when the widget doesn't provide a conversationId.
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.text();
    let mode = 'buddy';
    try {
      const parsed = JSON.parse(body);
      mode = parsed.mode || 'buddy';
    } catch {}

    const agentId = process.env.ELEVENLABS_AGENT_ID || 'agent_6301kncrnakkft1seqw159q12j6b';

    // Fetch the most recent conversation from ElevenLabs
    const listUrl = new URL('https://api.elevenlabs.io/v1/convai/conversations');
    listUrl.searchParams.set('agent_id', agentId);
    listUrl.searchParams.set('page_size', '1');

    const listRes = await fetch(listUrl.toString(), {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
    });

    if (!listRes.ok) {
      return NextResponse.json({ error: 'Failed to list conversations' }, { status: 502 });
    }

    const listData = await listRes.json();
    const latest = listData.conversations?.[0];
    if (!latest) {
      return NextResponse.json({ error: 'No conversations found' }, { status: 404 });
    }

    await dbConnect();

    // Check if already saved
    const existing = await ConversationMemory.findOne({
      conversationId: latest.conversation_id,
    });
    if (existing) {
      return NextResponse.json({ success: true, alreadySaved: true });
    }

    // Forward to the main conversations save endpoint logic
    const saveRes = await fetch(new URL('/api/voice-agent/conversations', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ conversationId: latest.conversation_id, mode }),
    });

    const saveData = await saveRes.json();
    return NextResponse.json(saveData);
  } catch (error) {
    console.error('[sync-latest] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
