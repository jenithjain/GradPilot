import { NextResponse } from 'next/server';
import { getReasoningModel, generateWithRetry, parseJSONFromResponse } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { brief } = await request.json();

    if (!brief || typeof brief !== 'string' || brief.trim().length === 0) {
      return NextResponse.json(
        { error: 'Campaign brief is required' },
        { status: 400 }
      );
    }

    const model = getReasoningModel();

    const systemPrompt = `You are a highly experienced Education Counselling Strategist at Fateh Education with expertise in creating comprehensive student outreach and counselling campaigns for overseas education.

Your task is to analyze the user's campaign brief and formulate a strategic foundation for their student outreach campaign.

IMPORTANT: You must respond with ONLY a valid JSON object. Do not include any markdown formatting, code blocks, or explanatory text.

The JSON object must have exactly two fields:
1. "title": A concise, compelling campaign name (3-7 words maximum) that captures the essence of the campaign
2. "rationale": A detailed strategic analysis in HTML format that includes:
   - Target Student Segment Analysis (academic level, geographic location, field of study interests, test readiness, financial profile)
   - Core Strategic Concept (the big idea that connects Fateh Education's offerings to student aspirations)
   - Key Messaging Pillars (3-5 main themes — e.g. career transformation, scholarship access, expert counselling, 45,000+ success stories)
   - Brand Tone & Voice guidelines (empathetic, encouraging, mentor-like)
   - Channel Strategy recommendations (Instagram, YouTube, WhatsApp, webinars, campus outreach, email nurture)
   - Lead Qualification Strategy (Hot/Warm/Cold scoring based on intent, financial readiness, timeline urgency)
   - Success Metrics to track (lead score distribution, counselling bookings, application submissions, conversion rate)

The rationale should be formatted as clean HTML with <h3> tags for sections, <p> tags for paragraphs, <ul> and <li> for lists, and <strong> for emphasis.

User's Campaign Brief:
${brief}

Respond with ONLY the JSON object:`;

    const responseText = await generateWithRetry(model, systemPrompt);
    const parsedResponse = parseJSONFromResponse(responseText);

    // Validate the response structure
    if (!parsedResponse.title || !parsedResponse.rationale) {
      throw new Error('Invalid response structure from AI model');
    }

    return NextResponse.json({
      title: parsedResponse.title,
      rationale: parsedResponse.rationale,
    });

  } catch (error) {
    console.error('Error generating strategy:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate campaign strategy',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
