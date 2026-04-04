import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

/**
 * DELETE /api/voice-agent/end-session
 * Explicitly terminates an ElevenLabs conversation via their REST API.
 * This frees the concurrent conversation slot immediately instead of waiting
 * for the server-side timeout (30–60 s), preventing the "quota limit" error
 * when the user tries to start a new conversation shortly after.
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await request.json();
    if (!conversationId) {
      // Nothing to terminate — not an error
      return NextResponse.json({ success: true, message: 'No conversation to terminate' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'No API key' }, { status: 500 });
    }

    // Call ElevenLabs to delete/end the conversation — this releases the concurrent slot
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
      {
        method: 'DELETE',
        headers: { 'xi-api-key': apiKey },
      }
    );

    // 200 or 404 (already gone) are both fine
    if (elRes.ok || elRes.status === 404) {
      return NextResponse.json({ success: true });
    }

    const body = await elRes.text();
    console.warn('[end-session] ElevenLabs DELETE returned', elRes.status, body);
    // Non-fatal — still return success so the client can continue
    return NextResponse.json({ success: true, warning: `EL status ${elRes.status}` });
  } catch (err) {
    console.error('[end-session] Error:', err);
    // Non-fatal
    return NextResponse.json({ success: true, warning: err.message });
  }
}
