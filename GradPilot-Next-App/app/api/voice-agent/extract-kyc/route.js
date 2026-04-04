import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

/**
 * Enum values from StudentProfileSchema — Gemini must output EXACTLY one of these.
 */
const SCHEMA_ENUMS = {
  educationLevel: ['10th/SSC', '12th/HSC', 'Diploma', 'Bachelors', 'Masters', 'PhD', 'Other'],
  fieldOfStudy: ['Engineering', 'Business/MBA', 'Medicine', 'Arts & Humanities', 'Science', 'Law', 'IT/Computer Science', 'Other'],
  gpaPercentage: ['Below 50%', '50-60%', '60-70%', '70-80%', '80-90%', '90%+'],
  testStatus: ['Not Started', 'Preparing', 'Booked Exam', 'Score Available', 'Not Required'],
  testScore: ['Below 5.5', '5.5-6.0', '6.0-6.5', '6.5-7.0', '7.0-7.5', '7.5+', 'N/A'],
  targetCountries: ['UK', 'Ireland', 'USA', 'Canada', 'Australia', 'Germany', 'Other'],
  courseInterest: ['Undergraduate', 'Postgraduate/Masters', 'PhD/Research', 'Foundation Year', 'English Language Course', 'Other'],
  intakeTiming: ['January 2026', 'May 2026', 'September 2026', 'January 2027', 'Not Sure'],
  applicationTimeline: ['Immediately', 'Within 1 Month', '1-3 Months', '3-6 Months', '6+ Months'],
  budgetRange: ['Below ₹10 Lakhs', '₹10-20 Lakhs', '₹20-30 Lakhs', '₹30-50 Lakhs', '₹50 Lakhs+'],
  scholarshipInterest: ['Yes, definitely need scholarship', 'Interested but not essential', 'No, self-funded', 'Education loan planned'],
  primaryObjective: ['Career Advancement', 'Better Job Opportunities', 'Research & Academia', 'Immigration/PR', 'Personal Growth', 'Other'],
  painPoints: ['University Selection', 'Visa Process', 'Financial Planning', 'Test Preparation', 'Application Deadlines', 'Accommodation'],
  documentType: ['Student ID Card', 'Marksheet/Transcript', 'Degree Certificate', 'Passport', 'Other'],
};

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId, partial } = await request.json();
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    // 1. Fetch transcript from ElevenLabs
    const elResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
      { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }
    );

    if (!elResponse.ok) {
      console.error('[extract-kyc] ElevenLabs API error:', elResponse.status);
      return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 502 });
    }

    const elData = await elResponse.json();
    const transcript = (elData.transcript || [])
      .filter((t) => t.role !== 'tool')
      .map((t) => `${t.role === 'user' ? 'Student' : 'Agent'}: ${t.message || ''}`)
      .join('\n');

    if (!transcript.trim()) {
      // Empty transcript — save conversation memory only, don't extract
      return NextResponse.json({ success: true, partial: true, message: 'Conversation saved (no data to extract)' });
    }

    // 2. Use Gemini to extract structured KYC data
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a precise data extraction engine. Extract student KYC/profile data from the following conversation transcript between an AI counselling agent and a student.

You MUST output a JSON object with EXACTLY these keys. Each value MUST be one of the allowed enum values shown.
If the student did NOT mention a field at all, set it to null (JSON null, not the string "null").
Only use the fallback values like "Other"/"Not Sure"/"N/A" when the student DID mention the topic but their answer doesn't match any enum exactly.

FIELD DEFINITIONS (use EXACTLY these values):

educationLevel: ${JSON.stringify(SCHEMA_ENUMS.educationLevel)}
fieldOfStudy: ${JSON.stringify(SCHEMA_ENUMS.fieldOfStudy)}
institution: (free text — the name of their college/university/school)
gpaPercentage: ${JSON.stringify(SCHEMA_ENUMS.gpaPercentage)}
testStatus: ${JSON.stringify(SCHEMA_ENUMS.testStatus)}
testScore: ${JSON.stringify(SCHEMA_ENUMS.testScore)}
targetCountries: ${JSON.stringify(SCHEMA_ENUMS.targetCountries)} (array — pick all that apply)
courseInterest: ${JSON.stringify(SCHEMA_ENUMS.courseInterest)}
intakeTiming: ${JSON.stringify(SCHEMA_ENUMS.intakeTiming)}
applicationTimeline: ${JSON.stringify(SCHEMA_ENUMS.applicationTimeline)}
budgetRange: ${JSON.stringify(SCHEMA_ENUMS.budgetRange)}
scholarshipInterest: ${JSON.stringify(SCHEMA_ENUMS.scholarshipInterest)}
primaryObjective: ${JSON.stringify(SCHEMA_ENUMS.primaryObjective)}
painPoints: ${JSON.stringify(SCHEMA_ENUMS.painPoints)} (array — pick all that apply)
documentType: ${JSON.stringify(SCHEMA_ENUMS.documentType)}
studentName: (free text — the student's name if mentioned)

IMPORTANT RULES:
- targetCountries and painPoints are ARRAYS. Wrap them in [].
- All other enum fields are single strings, NOT arrays.
- Use EXACT enum values including special characters like ₹.
- If the student says "IELTS 7" → testScore should be "7.0-7.5", testStatus should be "Score Available".
- If the student says "engineering" → fieldOfStudy should be "Engineering".
- If budget info seems like 10-20 lakhs → budgetRange should be "₹10-20 Lakhs".
- If the student did NOT mention a topic at all, use null for that field.
- Only use "Other" / "Not Sure" / "N/A" when the student DID discuss the topic but gave a non-standard answer.
- For documentType, use null if not discussed.
- This may be a PARTIAL conversation (cut short). Extract whatever was mentioned and leave the rest as null.

Transcript:
${transcript}

Respond ONLY with valid JSON, no markdown fences, no extra text.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    let profileData;
    try {
      profileData = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    } catch {
      console.error('[extract-kyc] Gemini returned invalid JSON:', text);
      return NextResponse.json({ error: 'Failed to parse extracted profile' }, { status: 500 });
    }

    // 3. Validate and sanitize against enums
    // Count how many fields were actually extracted (non-null)
    let extractedCount = 0;

    for (const [field, allowed] of Object.entries(SCHEMA_ENUMS)) {
      const val = profileData[field];

      if (val === null || val === undefined) {
        // Field not mentioned — keep as null for now
        profileData[field] = null;
        continue;
      }

      extractedCount++;

      if (field === 'targetCountries' || field === 'painPoints') {
        // Array fields
        if (!Array.isArray(val)) {
          profileData[field] = val ? [val] : null;
        }
        if (profileData[field]) {
          profileData[field] = profileData[field]
            .map((v) => allowed.find((a) => a.toLowerCase() === String(v).toLowerCase()) || null)
            .filter(Boolean);
          if (profileData[field].length === 0) profileData[field] = null;
        }
      } else {
        // Single-value enum fields
        if (!allowed.includes(val)) {
          const match = allowed.find((a) => a.toLowerCase() === String(val).toLowerCase());
          profileData[field] = match || null;
        }
      }
    }

    // Ensure institution is a string or null
    if (profileData.institution && typeof profileData.institution === 'string') {
      extractedCount++;
    } else {
      profileData.institution = null;
    }

    // 4. Save to MongoDB
    await dbConnect();

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build clean profile — merge with existing data so we don't lose previously collected fields
    const existingProfile = user.studentProfile || {};

    // Determine if this is a complete or partial profile
    // Count core fields present in EITHER new extraction OR existing profile
    const coreFields = ['educationLevel', 'fieldOfStudy', 'targetCountries', 'courseInterest', 'budgetRange', 'testStatus'];
    const coreFieldsPresent = coreFields.filter(
      (f) => (profileData[f] !== null && profileData[f] !== undefined) ||
             (existingProfile[f] !== null && existingProfile[f] !== undefined)
    ).length;
    const isComplete = coreFieldsPresent >= 5;
    const defaults = {
      educationLevel: 'Other',
      fieldOfStudy: 'Other',
      institution: 'Not specified',
      gpaPercentage: 'Below 50%',
      testStatus: 'Not Started',
      testScore: 'N/A',
      targetCountries: ['UK'],
      courseInterest: 'Other',
      intakeTiming: 'Not Sure',
      applicationTimeline: '6+ Months',
      budgetRange: 'Below ₹10 Lakhs',
      scholarshipInterest: 'Interested but not essential',
      primaryObjective: 'Other',
      painPoints: ['University Selection'],
      documentType: 'Other',
    };

    const cleanProfile = {};
    for (const field of Object.keys(defaults)) {
      if (profileData[field] !== null && profileData[field] !== undefined) {
        // New data from this conversation takes priority
        cleanProfile[field] = profileData[field];
      } else if (existingProfile[field] !== null && existingProfile[field] !== undefined) {
        // Keep existing data from previous conversations
        cleanProfile[field] = existingProfile[field];
      } else {
        // No data from either — use default
        cleanProfile[field] = defaults[field];
      }
    }

    cleanProfile.verificationStatus = 'Pending';
    cleanProfile.completedAt = new Date();

    if (profileData.studentName) {
      cleanProfile.studentName = String(profileData.studentName);
    }

    await User.findByIdAndUpdate(
      session.user.id,
      {
        studentProfile: cleanProfile,
        hasCompletedKYC: isComplete,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    return NextResponse.json({
      success: true,
      partial: !isComplete,
      message: isComplete
        ? 'Profile extracted and saved from voice conversation'
        : 'Partial profile saved — continue the conversation to complete it',
      profile: cleanProfile,
      extractedFields: extractedCount,
    });
  } catch (error) {
    console.error('[extract-kyc] Error:', error);
    return NextResponse.json(
      { error: 'Failed to extract and save profile' },
      { status: 500 }
    );
  }
}
