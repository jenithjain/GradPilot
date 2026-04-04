import { NextResponse } from 'next/server';
import { getReasoningModel, generateWithRetry, parseJSONFromResponse } from '@/lib/gemini';

export async function POST(request: Request) {
  let descriptionValue = '';
  try {
    const { description } = await request.json();
    descriptionValue = typeof description === 'string' ? description : '';

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    const model = getReasoningModel();

    const systemPrompt = `You are an expert education campaign strategist for Fateh Education, a leading overseas education consultancy specializing in UK and Ireland university placements. Your task is to transform a user's rough campaign description into a well-structured, detailed student outreach campaign brief.

The user has provided this description:
"${descriptionValue}"

Transform this into a comprehensive student outreach campaign brief that includes:
- Clear description of the outreach goal (student recruitment, scholarship promotion, webinar invitation, etc.)
- Specific target student segment (academic level, geography, field of study, test readiness)
- Campaign timing aligned with university intake cycles (Sep/Jan intakes, IELTS dates)
- Key messaging pillars and unique value propositions (45,000+ placements, 120+ partner universities, expert counsellors)
- Recommended outreach channels (Instagram, YouTube, WhatsApp, webinars, email, campus events)
- Desired outcomes (counselling bookings, lead score distribution, application submissions)

Make it compelling, specific, and actionable. Keep the original intent but enhance with education marketing best practices.

IMPORTANT CONSTRAINTS:
- Maximum length: 500-600 characters
- Be concise but comprehensive
- Focus on the most critical campaign elements
- Maintain an empathetic, student-first tone

IMPORTANT: Respond with ONLY a valid JSON object containing a single field "enhancedBrief" with the improved campaign brief text. Do not include markdown, code blocks, or any other text.

Example format:
{"enhancedBrief": "Launch a multi-channel student outreach campaign targeting final-year graduates interested in UK postgraduate programs..."}`;

    const responseText = await generateWithRetry(model, systemPrompt);
    let parsedResponse: any = null;
    let usedFallback = false;
    try {
      parsedResponse = parseJSONFromResponse(responseText);
    } catch (e) {
      // Fallback: build a concise enhanced brief manually
      usedFallback = true;
      const base = description.trim();
      const enhanced = `Campaign: ${base.slice(0, 140)}. Target: students interested in UK/Ireland study abroad. Focus: highlight expert counselling, scholarship guidance, 45,000+ placements. Channels: Instagram + WhatsApp + email + webinars. Goal: boost counselling bookings & lead qualification.`;
      parsedResponse = { enhancedBrief: enhanced };
    }

    // Validate / normalize enhancedBrief
    let enhancedBrief: string = String(parsedResponse.enhancedBrief || '').trim();
    if (!enhancedBrief) {
      throw new Error('AI did not return enhancedBrief');
    }
    // Enforce max length ~600 chars
    if (enhancedBrief.length > 600) {
      enhancedBrief = enhancedBrief.slice(0, 597).replace(/\s+$/,'') + '…';
    }
    return NextResponse.json({
      enhancedBrief,
      fallback: usedFallback
    });

  } catch (error) {
    console.error('Error enhancing brief:', error);
    // Final safety fallback (route still returns 200 with deterministic brief)
    const fbSource = descriptionValue || '';
    const fallbackBrief = `Campaign: ${fbSource.slice(0,120)}. Channels: Instagram + WhatsApp + email. Goal: counselling bookings & lead qualification.`;
    return NextResponse.json({ enhancedBrief: fallbackBrief, fallback: true, error: error instanceof Error ? error.message : 'Enhancement error' });
  }
}
