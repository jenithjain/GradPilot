import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function buildPrompt(profileSummary) {
  return `You are an expert overseas education counsellor at a premium consultancy. Analyze the student profile below and generate a comprehensive, personalized dashboard analysis.

STUDENT PROFILE:
- Name: ${profileSummary.name}
- Education Level: ${profileSummary.education}
- Field of Study: ${profileSummary.field}
- Institution: ${profileSummary.institution}
- GPA/Score: ${profileSummary.gpa}
- Target Countries: ${profileSummary.targetCountries.join(", ") || "Not specified"}
- Course Interest: ${profileSummary.course}
- English Test Status: ${profileSummary.testStatus}
- Annual Budget: ${profileSummary.budget}
- Application Timeline: ${profileSummary.timeline}
- Current Location: ${profileSummary.location}

Based on your knowledge, suggest REAL, currently existing universities that match this student's profile, budget, and target countries. Include actual programs, realistic tuition ranges, and scholarship info.

RESPOND WITH ONLY A VALID JSON OBJECT (no markdown, no code blocks, no explanation):

{
  "aiInsight": {
    "headline": "One compelling sentence about the student's profile strength (use their name)",
    "body": "2-3 sentences of personalized analysis covering strengths, gaps, and next steps",
    "matchCount": <number of university matches found, realistic 5-25>,
    "avgFit": "<percentage like 78%>",
    "urgentCount": <number of urgent action items 1-5>,
    "topPickLabel": "One sentence about their best opportunity"
  },
  "universities": [
    {
      "name": "Real University Name",
      "country": "Country",
      "program": "Specific program name",
      "matchScore": <60-98>,
      "tuitionRange": "Annual tuition in local currency",
      "scholarships": "Available scholarship info or 'Check website'",
      "deadline": "Next application deadline if known",
      "reason": "Why this is a good match for the student"
    }
  ],
  "recommendations": [
    {
      "title": "Specific action item title",
      "category": "academic|test|financial|documents|visa",
      "urgency": "urgent|important|optional",
      "description": "2 sentences explaining what to do and why"
    }
  ],
  "wellbeing": {
    "focus": <30-95>,
    "confidence": <30-95>,
    "stress": <20-80>,
    "assessment": "2 sentences about the student's readiness mindset based on their profile completeness and timeline"
  },
  "progressTrend": [
    {"month": "Month abbreviation", "score": <10-100>}
  ],
  "sessions": [
    {
      "topic": "Recommended next counselling session topic",
      "priority": "high|medium|low",
      "reason": "Why this session matters now"
    }
  ],
  "budgetBreakdown": [
    {"name": "Tuition", "pct": <number>},
    {"name": "Living", "pct": <number>},
    {"name": "Travel", "pct": <number>},
    {"name": "Insurance", "pct": <number>},
    {"name": "Misc", "pct": <number>}
  ],
  "radarScores": {
    "academics": <20-100>,
    "language": <20-100>,
    "finances": <20-100>,
    "clarity": <20-100>,
    "timeline": <20-100>
  },
  "journeySteps": [
    {
      "id": 1,
      "status": "completed|current|locked",
      "description": "Personalized description of what the student has done or needs to do for this step",
      "actions": ["Specific action 1 for this student", "Specific action 2", "Specific action 3"],
      "goal": "The specific goal for this step based on the student's profile"
    },
    {
      "id": 2,
      "status": "completed|current|locked",
      "description": "...",
      "actions": ["...", "...", "..."],
      "goal": "..."
    },
    { "id": 3, "status": "...", "description": "...", "actions": ["..."], "goal": "..." },
    { "id": 4, "status": "...", "description": "...", "actions": ["..."], "goal": "..." },
    { "id": 5, "status": "...", "description": "...", "actions": ["..."], "goal": "..." },
    { "id": 6, "status": "...", "description": "...", "actions": ["..."], "goal": "..." },
    { "id": 7, "status": "...", "description": "...", "actions": ["..."], "goal": "..." }
  ]
}

IMPORTANT:
- Include 4-8 REAL universities from the student's target countries that actually offer their course of interest
- University names, programs, and tuition must be factual
- Make the AI insight deeply personalized with specific advice
- Progress trend should show 6-8 months of realistic progression
- All numbers should be realistic and internally consistent
- If budget is mentioned, calibrate university suggestions accordingly
- If test status is pending, flag it as urgent
- Include 3-5 recommendations and 2-3 sessions
- journeySteps must have exactly 7 items (ids 1-7) corresponding to: 1=Profile Completion, 2=IELTS/TOEFL Prep, 3=University Shortlisting, 4=SOP & LOR, 5=Application Submission, 6=Visa Process, 7=Departure Ready
- For each journey step, set status based on what the student has ACTUALLY completed: "completed" if done, "current" if they should work on it now, "locked" if it's too early. Only one step should be "current".
- Personalize each step's description and actions based on the student's specific profile (e.g., mention their target countries, course, test status, budget)
- Each step's goal should be a concise, motivating target specific to this student`;
}

function extractJSON(text) {
  let cleaned = text.trim();
  // Remove markdown code blocks
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find JSON object in the text
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Could not extract JSON from response");
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profile } = await request.json();
    if (!profile || typeof profile !== "object") {
      return NextResponse.json({ error: "Profile data required" }, { status: 400 });
    }

    const profileSummary = {
      name: profile.studentName || profile.name || "Student",
      education: profile.educationLevel || "",
      field: profile.fieldOfStudy || "",
      institution: profile.institution || "",
      gpa: profile.gpaPercentage || "",
      targetCountries: Array.isArray(profile.targetCountries)
        ? profile.targetCountries
        : [],
      course: profile.courseInterest || profile.fieldOfStudy || "",
      testStatus: profile.englishTestStatus || "",
      budget: profile.budgetRange || "",
      timeline: profile.applicationTimeline || "",
      location: profile.currentLocation || "",
    };

    const prompt = buildPrompt(profileSummary);

    // Try with Google Search grounding first, fall back to plain generation
    let text;
    try {
      const groundedModel = genAI.getGenerativeModel({
        model: "gemini-2.5-pro",
        generationConfig: {
          temperature: 0.85,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
        tools: [{ googleSearch: {} }],
      });
      const result = await groundedModel.generateContent(prompt);
      text = result.response.text();
    } catch (groundingErr) {
      console.warn("[Dashboard Analyze] Grounding failed, falling back to plain generation:", groundingErr.message);
      const plainModel = genAI.getGenerativeModel({
        model: "gemini-2.5-pro",
        generationConfig: {
          temperature: 0.85,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      });
      const result = await plainModel.generateContent(prompt);
      text = result.response.text();
    }

    const analysis = extractJSON(text);

    return NextResponse.json({ analysis, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[Dashboard Analyze] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate analysis", details: err.message },
      { status: 500 }
    );
  }
}
