import { NextResponse } from 'next/server';
import { handleIncomingMessage } from '@/lib/whatsapp/handleIncoming';

/**
 * POST /api/whatsapp/webhook
 *
 * Receives incoming WhatsApp messages from Whapi.cloud.
 * Configure this URL in your Whapi channel settings under Webhooks → Messages.
 *
 * Optionally set WHAPI_WEBHOOK_SECRET in your .env to verify requests.
 */
export async function POST(request) {
  try {
    // Optional webhook secret verification (set in Whapi dashboard)
    const secret = process.env.WHAPI_WEBHOOK_SECRET;
    if (secret) {
      const incoming = request.headers.get('x-whapi-secret') || request.headers.get('authorization');
      if (!incoming || incoming.replace('Bearer ', '') !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Whapi payload structure:
    // { messages: [{ from: "919...", text: { body: "..." }, type: "text" }] }
    const messages = body.messages || body.data?.messages || [];

    for (const msg of messages) {
      // Skip non-text, outbound, and status updates
      if (msg.type !== 'text') continue;
      if (msg.from_me === true) continue;

      // Only process 1:1 chats, skip group messages
      const chatId = msg.chat_id || '';
      if (chatId.endsWith('@g.us')) continue;

      const phoneNumber = String(msg.from || chatId).replace(/@.*$/, '').replace(/[^0-9]/g, '');
      const messageText = msg.text?.body || msg.body || '';

      if (!phoneNumber || !messageText) continue;

      // Process asynchronously — respond 200 to Whapi immediately
      handleIncomingMessage(phoneNumber, messageText).catch((err) =>
        console.error('[whatsapp-webhook] handler error:', err)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[whatsapp-webhook] error:', error);
    // Always return 200 to prevent Whapi from retrying on our errors
    return NextResponse.json({ received: true });
  }
}

/**
 * GET /api/whatsapp/webhook
 * Whapi may send a GET request to verify the webhook URL — return 200 OK.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'GradPilot WhatsApp Webhook' });
}
