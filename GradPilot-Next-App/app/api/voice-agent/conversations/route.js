import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import ConversationMemory from '@/lib/models/ConversationMemory';

// Save a conversation after it ends
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.text();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const { conversationId, mode } = parsed;
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    // Fetch the full transcript from ElevenLabs API
    const elResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
      {
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
      }
    );

    if (!elResponse.ok) {
      console.error('[conversations] ElevenLabs API error:', elResponse.status);
      return NextResponse.json(
        { error: 'Failed to fetch conversation from ElevenLabs' },
        { status: 502 }
      );
    }

    const elData = await elResponse.json();

    const messages = (elData.transcript || []).map((t) => ({
      role: t.role === 'agent' ? 'agent' : t.role === 'tool' ? 'tool' : 'user',
      message: t.message || '',
      timeInCallSecs: t.time_in_call_secs || 0,
    }));

    // Build a summary from the conversation using Gemini
    let summary = '';
    const extractedFacts = {};

    if (messages.length > 0) {
      const transcript = messages
        .filter((m) => m.role !== 'tool')
        .map((m) => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.message}`)
        .join('\n');

      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const result = await model.generateContent(
          `You are a memory extraction engine for a student counselling AI buddy called GradPilot.
Analyze this conversation transcript and produce a JSON object with exactly two keys:
1. "summary": A concise 2-3 sentence summary of what was discussed, focusing on the student's needs, preferences, emotional state, and any decisions made.
2. "facts": An object of key-value pairs of important facts learned about the student (e.g. name, target country, budget, test scores, concerns, preferences, mood, goals, timeline). Only include facts that were explicitly mentioned.

Transcript:
${transcript}

Respond ONLY with valid JSON, no markdown.`
        );

        const text = result.response.text().trim();
        const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
        summary = parsed.summary || '';
        if (parsed.facts && typeof parsed.facts === 'object') {
          for (const [k, v] of Object.entries(parsed.facts)) {
            if (typeof v === 'string' || typeof v === 'number') {
              extractedFacts[String(k)] = String(v);
            }
          }
        }
      } catch (err) {
        console.error('[conversations] Summary generation failed:', err.message);
        // Fallback: simple summary
        summary = `Conversation with ${messages.length} messages, duration ${elData.metadata?.call_duration_secs || 0}s.`;
      }
    }

    await dbConnect();

    const doc = await ConversationMemory.findOneAndUpdate(
      { conversationId },
      {
        userId: session.user.id,
        conversationId,
        agentId: elData.agent_id,
        messages,
        summary,
        extractedFacts,
        callDurationSecs: elData.metadata?.call_duration_secs || 0,
        mode: mode || 'buddy',
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, id: doc._id });
  } catch (error) {
    console.error('[conversations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get all conversations for the current user
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    const conversations = await ConversationMemory.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('conversationId summary extractedFacts callDurationSecs mode createdAt')
      .lean();

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('[conversations] GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
