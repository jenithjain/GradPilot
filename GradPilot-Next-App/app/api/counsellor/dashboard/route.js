import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import PastWorkflow from '@/lib/models/PastWorkflow';
import ConversationMemory from '@/lib/models/ConversationMemory';
import User from '@/lib/models/User';

/**
 * GET /api/counsellor/dashboard
 * Returns aggregated data for the counsellor dashboard:
 * - Campaign summaries (from saved workflows)
 * - Student voice session summaries (from conversation memories)
 * - CSV leads extracted from campaign web-research nodes
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 1. Fetch saved campaigns/workflows for this counsellor
    const workflows = await PastWorkflow.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const campaigns = workflows.map((w) => {
      // Extract leads from workflow nodes — prefer structured metadata, fall back to CSV text
      const csvLeads = [];
      const seenKeys = new Set();

      for (const node of (w.nodes || [])) {
        const meta = node.data?.metadata || {};

        // --- Strategy 1: Use structured metadata arrays (most reliable) ---
        const metaLeads = meta.allLeadsWithEmail || meta.leadsWithEmail || meta.studentLeadsWithEmail || [];
        if (Array.isArray(metaLeads) && metaLeads.length > 0) {
          for (const ml of metaLeads) {
            const name = (ml.name || '').trim();
            if (!name) continue;
            const key = `${name}|${(ml.email || '').toLowerCase()}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            csvLeads.push({
              name,
              type: ml.type || ml.category || 'Lead',
              source: ml.sourceUrl || ml.url || ml.source || '',
              relevance: parseInt(ml.score || ml.relevance || '0') || 0,
              email: ml.email || '',
              phone: ml.phone || '',
              contactInfo: ml.contactInfo || '',
              notes: ml.notes || '',
            });
          }
          continue; // metadata found for this node — skip CSV fallback
        }

        // --- Strategy 2: Fall back to CSV text in output ---
        const output = node.data?.output || node.data?.generatedOutput || '';
        if (typeof output === 'string' && output.includes('Name')) {
          const csvMatch = output.match(/```(?:csv)?\n([\s\S]*?)```/);
          if (csvMatch) {
            const lines = csvMatch[1].trim().split('\n');
            const rawHeaders = lines[0]?.split(',').map((h) => h.trim().toLowerCase());
            const hi = {
              name: rawHeaders?.findIndex((h) => h === 'name') ?? 0,
              type: rawHeaders?.findIndex((h) => h === 'type') ?? 1,
              source: rawHeaders?.findIndex((h) => h.includes('source')) ?? 2,
              relevance: rawHeaders?.findIndex((h) => h.includes('relevance') || h.includes('score')) ?? 3,
              email: rawHeaders?.findIndex((h) => h === 'email') ?? 4,
              phone: rawHeaders?.findIndex((h) => h === 'phone') ?? 5,
              contactInfo: rawHeaders?.findIndex((h) => h.includes('contact')) ?? 6,
              notes: rawHeaders?.findIndex((h) => h === 'notes') ?? 7,
            };
            for (let i = 1; i < lines.length; i++) {
              // Smart CSV split — respect quoted values with commas inside
              const vals = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map((v) => v.trim().replace(/^"|"$/g, '')) || lines[i].split(',').map((v) => v.trim());
              if (vals.length >= 2) {
                const name = (hi.name >= 0 ? vals[hi.name] : vals[0]) || '';
                if (!name) continue;
                const key = `${name}|${(hi.email >= 0 ? vals[hi.email] : '').toLowerCase()}`;
                if (seenKeys.has(key)) continue;
                seenKeys.add(key);
                csvLeads.push({
                  name,
                  type: (hi.type >= 0 ? vals[hi.type] : vals[1]) || 'Lead',
                  source: (hi.source >= 0 ? vals[hi.source] : vals[2]) || '',
                  relevance: parseInt((hi.relevance >= 0 ? vals[hi.relevance] : vals[3]) || '0') || 0,
                  email: (hi.email >= 0 ? vals[hi.email] : vals[4]) || '',
                  phone: (hi.phone >= 0 ? vals[hi.phone] : vals[5]) || '',
                  contactInfo: (hi.contactInfo >= 0 ? vals[hi.contactInfo] : vals[6]) || '',
                  notes: (hi.notes >= 0 ? vals[hi.notes] : vals[7]) || '',
                });
              }
            }
          }
        }
      }

      // Count executed nodes
      const totalNodes = (w.nodes || []).length;
      const completedNodes = (w.nodes || []).filter(
        (n) => n.data?.status === 'complete' || n.data?.status === 'completed'
      ).length;

      return {
        id: w._id.toString(),
        brief: w.brief || '',
        createdAt: w.createdAt,
        nodesCount: totalNodes,
        completedNodes,
        csvLeads,
      };
    });

    // 2. Fetch recent voice/conversation sessions (all students)
    const conversations = await ConversationMemory.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const voiceSessions = [];
    for (const conv of conversations) {
      // Look up the student user
      const studentUser = await User.findById(conv.userId).select('name email image studentProfile').lean();
      if (!studentUser) continue;

      const facts = conv.extractedFacts instanceof Map
        ? Object.fromEntries(conv.extractedFacts)
        : (conv.extractedFacts || {});

      voiceSessions.push({
        conversationId: conv.conversationId,
        studentName: studentUser.name || facts.name || 'Unknown Student',
        studentEmail: studentUser.email,
        summary: conv.summary || '',
        extractedFacts: facts,
        callDuration: conv.callDurationSecs || 0,
        messagesCount: (conv.messages || []).length,
        mode: conv.mode || 'onboarding',
        createdAt: conv.createdAt,
        // KYC data from student profile
        studentProfile: studentUser.studentProfile ? {
          targetCountries: studentUser.studentProfile.targetCountries || [],
          courseInterest: studentUser.studentProfile.courseInterest || '',
          testStatus: studentUser.studentProfile.testStatus || '',
          testScore: studentUser.studentProfile.testScore || '',
          budgetRange: studentUser.studentProfile.budgetRange || '',
        } : null,
      });
    }

    return NextResponse.json({
      campaigns,
      voiceSessions,
    });
  } catch (error) {
    console.error('[counsellor/dashboard] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
