import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const INCOMPLETE_TEST_PATTERNS = [
  /not\s*started/i,
  /not\s*taken/i,
  /preparing/i,
  /planning/i,
  /booked/i,
  /soon/i,
  /pending/i,
];

function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function isTestIncomplete(testStatus) {
  if (isBlank(testStatus)) return true;
  return INCOMPLETE_TEST_PATTERNS.some((pattern) => pattern.test(String(testStatus)));
}

function detectMissingOrIncompleteFields(profileSummary) {
  const missing = [];

  if (isBlank(profileSummary.education)) missing.push("educationLevel");
  if (isBlank(profileSummary.field)) missing.push("fieldOfStudy");
  if (isBlank(profileSummary.course)) missing.push("courseInterest");
  if (isBlank(profileSummary.institution)) missing.push("institution");
  if (isBlank(profileSummary.gpa)) missing.push("gpaPercentage");
  if (isBlank(profileSummary.timeline)) missing.push("applicationTimeline");
  if (isBlank(profileSummary.budget)) missing.push("budgetRange");
  if (isBlank(profileSummary.targetCountries)) missing.push("targetCountries");
  if (isTestIncomplete(profileSummary.testStatus)) missing.push("englishTestStatus");

  return missing;
}

function buildProfileFingerprint(profileSummary) {
  const canonical = {
    name: String(profileSummary.name || "").trim().toLowerCase(),
    education: String(profileSummary.education || "").trim().toLowerCase(),
    field: String(profileSummary.field || "").trim().toLowerCase(),
    institution: String(profileSummary.institution || "").trim().toLowerCase(),
    gpa: String(profileSummary.gpa || "").trim().toLowerCase(),
    targetCountries: [...(profileSummary.targetCountries || [])]
      .map((v) => String(v || "").trim().toLowerCase())
      .sort(),
    course: String(profileSummary.course || "").trim().toLowerCase(),
    testStatus: String(profileSummary.testStatus || "").trim().toLowerCase(),
    budget: String(profileSummary.budget || "").trim().toLowerCase(),
    timeline: String(profileSummary.timeline || "").trim().toLowerCase(),
    location: String(profileSummary.location || "").trim().toLowerCase(),
  };

  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function buildRuleBasedJourneySteps(profileSummary) {
  const countries = profileSummary.targetCountries?.length
    ? profileSummary.targetCountries
    : ["your target country"];
  const countryLabel = countries.join(" and ");
  const courseLabel = profileSummary.course || profileSummary.field || "your chosen program";
  const testIncomplete = isTestIncomplete(profileSummary.testStatus);

  const statuses = [
    "completed",
    testIncomplete ? "current" : "completed",
    testIncomplete ? "locked" : "current",
    "locked",
    "locked",
    "locked",
    "locked",
  ];

  return [
    {
      id: 1,
      status: statuses[0],
      description: `Profile details captured for ${courseLabel} with a focus on ${countryLabel}.`,
      actions: [
        "Review personal and academic details",
        "Confirm preferred countries and budget band",
        "Keep profile documents updated",
      ],
      goal: "Profile foundation is complete",
    },
    {
      id: 2,
      status: statuses[1],
      description: testIncomplete
        ? "Your language-test milestone is still open and should be completed first."
        : "Language-test readiness is complete and no longer a blocker.",
      actions: testIncomplete
        ? [
            "Finalize IELTS/TOEFL exam timeline",
            "Prioritize score-improvement practice",
            "Prepare required registration documents",
          ]
        : [
            "Keep score report accessible for applications",
            "Map score bands to target universities",
            "Use score in shortlist filtering",
          ],
      goal: testIncomplete ? "Lock a competitive language score" : "Use your test score strategically",
    },
    {
      id: 3,
      status: statuses[2],
      description: `Build a short, high-fit shortlist for ${courseLabel} in ${countryLabel}.`,
      actions: [
        "Create reach-match-safe university buckets",
        "Validate tuition against your budget",
        "Shortlist universities by intake timeline",
      ],
      goal: "Finalize a strong shortlist",
    },
    {
      id: 4,
      status: statuses[3],
      description: "Prepare persuasive SOP and strong LOR assets aligned to your goals.",
      actions: [
        "Draft SOP with career narrative",
        "Request recommendation letters early",
        "Create a document-review checklist",
      ],
      goal: "Complete SOP and LOR set",
    },
    {
      id: 5,
      status: statuses[4],
      description: "Submit complete applications with all required evidence before deadlines.",
      actions: [
        "Complete university portal entries",
        "Upload verified documents",
        "Track deadline-wise submissions",
      ],
      goal: "Submit all priority applications",
    },
    {
      id: 6,
      status: statuses[5],
      description: "Prepare visa paperwork and financial proofs after receiving admission outcomes.",
      actions: [
        "Compile visa documentation checklist",
        "Arrange financial statements",
        "Schedule visa appointment timeline",
      ],
      goal: "Complete visa file preparation",
    },
    {
      id: 7,
      status: statuses[6],
      description: "Complete final pre-departure readiness tasks for a smooth transition.",
      actions: [
        "Finalize accommodation and travel",
        "Arrange insurance and forex",
        "Complete orientation and packing checklist",
      ],
      goal: "Be departure ready",
    },
  ];
}

function buildRuleBasedRecommendations(profileSummary, missingFields) {
  const testIncomplete = isTestIncomplete(profileSummary.testStatus);
  const countries = profileSummary.targetCountries?.length
    ? profileSummary.targetCountries.join(" / ")
    : "your target countries";
  const recommendations = [];

  if (testIncomplete) {
    recommendations.push({
      title: "Close language-test gap",
      category: "test",
      urgency: "urgent",
      description: `Prioritize IELTS/TOEFL completion since it directly impacts shortlist quality for ${countries}.`,
    });
  }

  if (missingFields.includes("budgetRange")) {
    recommendations.push({
      title: "Finalize budget ceiling",
      category: "financial",
      urgency: "important",
      description: "Set a clear annual budget range so program, tuition, and scholarship planning can be narrowed with confidence.",
    });
  }

  if (missingFields.includes("applicationTimeline")) {
    recommendations.push({
      title: "Lock your intake timeline",
      category: "academic",
      urgency: "important",
      description: "Choose a realistic application window to avoid deadline compression and last-minute document risk.",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "Advance to shortlist execution",
      category: "documents",
      urgency: "important",
      description: "Your core profile is stable. Move into shortlist finalization and application-document refinement.",
    });
  }

  while (recommendations.length < 3) {
    recommendations.push({
      title: "Prepare application documents",
      category: "documents",
      urgency: "optional",
      description: "Keep SOP, LOR, and transcripts organized so application submission remains smooth.",
    });
  }

  return recommendations.slice(0, 3);
}

function buildRuleBasedAnalysis(profileSummary, missingFields) {
  const countries = profileSummary.targetCountries?.length
    ? profileSummary.targetCountries
    : ["UK"];
  const primaryCountry = countries[0];
  const course = profileSummary.course || profileSummary.field || "your chosen program";
  const testIncomplete = isTestIncomplete(profileSummary.testStatus);
  const recommendations = buildRuleBasedRecommendations(profileSummary, missingFields);

  return {
    aiInsight: {
      headline: `${profileSummary.name}'s dashboard is ready with a focused action plan.`,
      body: testIncomplete
        ? `Language-test readiness is still the main blocker for ${course}. Closing this gap will significantly improve options in ${primaryCountry}.`
        : `Your profile for ${course} in ${primaryCountry} is progressing well. Focus on shortlist quality and document readiness for better outcomes.`,
      matchCount: Math.min((countries.length || 1) * 4, 20),
      avgFit: `${testIncomplete ? 68 : 82}%`,
      urgentCount: recommendations.filter((r) => r.urgency === "urgent").length || 1,
      topPickLabel: `Prioritize the next milestone for ${primaryCountry} applications.`,
    },
    recommendations,
    sessions: [
      {
        topic: testIncomplete ? "Language Test Strategy" : "University Shortlisting Workshop",
        priority: "high",
        reason: "This session resolves the biggest current bottleneck in your journey.",
      },
      {
        topic: "SOP and LOR Planning",
        priority: "medium",
        reason: "Early document preparation prevents downstream application delays.",
      },
    ],
    journeySteps: buildRuleBasedJourneySteps(profileSummary),
  };
}

function mergeAnalysisWithRuleBase(baseAnalysis, aiAnalysis) {
  const merged = {
    ...baseAnalysis,
    ...(aiAnalysis || {}),
    aiInsight: {
      ...(baseAnalysis.aiInsight || {}),
      ...((aiAnalysis && aiAnalysis.aiInsight) || {}),
    },
  };

  if (!Array.isArray(merged.recommendations) || merged.recommendations.length === 0) {
    merged.recommendations = baseAnalysis.recommendations;
  }

  if (!Array.isArray(merged.sessions) || merged.sessions.length === 0) {
    merged.sessions = baseAnalysis.sessions;
  }

  if (!Array.isArray(merged.journeySteps) || merged.journeySteps.length !== 7) {
    merged.journeySteps = baseAnalysis.journeySteps;
  }

  return merged;
}

function buildPrompt(profileSummary, missingFields) {
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

ONLY focus your generated insights on these incomplete/missing areas:
${missingFields.join(", ")}

For fields that are already complete, do not invent replacements and do not contradict existing profile values.

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

    const missingFields = detectMissingOrIncompleteFields(profileSummary);
    const profileFingerprint = buildProfileFingerprint(profileSummary);

    await dbConnect();

    const user = await User.findById(session.user.id).select("dashboardAnalysis").lean();
    const cached = user?.dashboardAnalysis;

    if (
      cached?.analysis &&
      cached?.profileFingerprint &&
      cached.profileFingerprint === profileFingerprint
    ) {
      return NextResponse.json({
        analysis: cached.analysis,
        generatedAt: cached.generatedAt,
        cached: true,
        source: cached.source || "local",
        usedGemini: cached.source === "gemini",
        missingFields: cached.missingFields || missingFields,
      });
    }

    const baseAnalysis = buildRuleBasedAnalysis(profileSummary, missingFields);

    // If the profile is complete, skip Gemini to avoid unnecessary usage.
    if (missingFields.length === 0) {
      await User.findByIdAndUpdate(session.user.id, {
        dashboardAnalysis: {
          profileFingerprint,
          missingFields,
          source: "local",
          model: "local-rules",
          generatedAt: new Date(),
          analysis: baseAnalysis,
        },
      });

      return NextResponse.json({
        analysis: baseAnalysis,
        generatedAt: new Date().toISOString(),
        cached: false,
        source: "local",
        usedGemini: false,
        missingFields,
      });
    }

    const prompt = buildPrompt(profileSummary, missingFields);

    let analysis = baseAnalysis;
    let source = "local";
    let model = "local-rules";

    if (process.env.GEMINI_API_KEY) {
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

      const aiAnalysis = extractJSON(text);
      analysis = mergeAnalysisWithRuleBase(baseAnalysis, aiAnalysis);
      source = "gemini";
      model = "gemini-2.5-pro";
    }

    await User.findByIdAndUpdate(session.user.id, {
      dashboardAnalysis: {
        profileFingerprint,
        missingFields,
        source,
        model,
        generatedAt: new Date(),
        analysis,
      },
    });

    return NextResponse.json({
      analysis,
      generatedAt: new Date().toISOString(),
      cached: false,
      source,
      usedGemini: source === "gemini",
      missingFields,
    });
  } catch (err) {
    console.error("[Dashboard Analyze] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate analysis", details: err.message },
      { status: 500 }
    );
  }
}
