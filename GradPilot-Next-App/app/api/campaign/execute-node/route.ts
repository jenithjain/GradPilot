import { NextResponse } from 'next/server';
import { getFlashModel, getImageModel, generateWithRetry } from '@/lib/gemini';
import { generateCampaignImages } from '@/lib/imagePrompts';
import { buildExecutionContext, compilePrompt } from '@/lib/execution-engine';
import { WorkflowNode, WorkflowEdge } from '@/types/workflow';
import { saveBase64Image } from '@/lib/fs-helpers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import { logAuditEvent } from '@/lib/audit-logger';
import {
  appendObservabilityLog,
  ensureObservabilityFolders,
  readLatestWebResearchSnapshot,
  saveWebResearchSnapshot,
} from '@/lib/agent-observability';

type EmailRecipient = { email: string; name?: string };
type CsvLeadRow = {
  name?: string;
  type?: string;
  email?: string;
  contactInfo?: string;
};
type EmailTemplate = { subject: string; html: string; text?: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXCLUDED_BROADCAST_TYPES = new Set(['community', 'competitor']);

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function isValidLeadEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (!EMAIL_REGEX.test(normalized)) return false;
  if (normalized.includes('(inferred)')) return false;
  if (normalized.includes('see url')) return false;
  return true;
}

function dedupeRecipients(recipients: EmailRecipient[]): EmailRecipient[] {
  const seen = new Set<string>();
  const unique: EmailRecipient[] = [];

  for (const recipient of recipients) {
    const normalizedEmail = normalizeEmail(recipient.email);
    if (!isValidLeadEmail(normalizedEmail) || seen.has(normalizedEmail)) {
      continue;
    }

    seen.add(normalizedEmail);
    unique.push({
      email: normalizedEmail,
      name: recipient.name?.trim() || undefined,
    });
  }

  return unique;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());

  return values;
}

function normalizeLeadType(type?: string): string {
  return String(type || '').trim().toLowerCase();
}

function parseCsvLeadRows(output: string): CsvLeadRow[] {
  if (!output) return [];

  const csvMatch = output.match(/```csv\s*([\s\S]*?)```/i);
  if (!csvMatch) return [];

  const csvContent = csvMatch[1].trim();
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length <= 1) return [];

  const header = lines[0].toLowerCase();
  const cols = header.split(',').map(col => col.replace(/"/g, '').trim());

  const emailColIdx = cols.findIndex(col => col === 'email');
  const contactColIdx = cols.findIndex(col => col === 'contact info');
  const nameColIdx = cols.findIndex(col => col === 'name');
  const typeColIdx = cols.findIndex(col => col === 'type');

  if (emailColIdx === -1 && contactColIdx === -1) return [];

  const rows: CsvLeadRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);

    let email = '';
    if (emailColIdx !== -1) {
      email = values[emailColIdx]?.replace(/"/g, '').trim() || '';
    }
    if (!email && contactColIdx !== -1) {
      const contact = values[contactColIdx]?.replace(/"/g, '').trim() || '';
      if (contact.includes('@')) {
        email = contact;
      }
    }

    const name = nameColIdx !== -1 ? values[nameColIdx]?.replace(/"/g, '').trim() : undefined;
    const type = typeColIdx !== -1 ? values[typeColIdx]?.replace(/"/g, '').trim() : undefined;
    const contactInfo = contactColIdx !== -1 ? values[contactColIdx]?.replace(/"/g, '').trim() : undefined;

    rows.push({ name, type, email, contactInfo });
  }

  return rows;
}

function extractRecipientsFromCsvOutput(
  output: string,
  options: { studentOnly?: boolean; excludeTypes?: Set<string> } = {}
): EmailRecipient[] {
  const rows = parseCsvLeadRows(output);
  const recipients: EmailRecipient[] = [];

  for (const row of rows) {
    const typeNormalized = normalizeLeadType(row.type);

    if (options.studentOnly && typeNormalized && !typeNormalized.includes('student')) {
      continue;
    }
    if (options.excludeTypes && options.excludeTypes.has(typeNormalized)) {
      continue;
    }

    const bestEmail = row.email || row.contactInfo || '';
    if (isValidLeadEmail(bestEmail)) {
      recipients.push({ email: bestEmail, name: row.name || undefined });
    }
  }

  return dedupeRecipients(recipients);
}

function extractRecipientsFromNodeMetadata(node: WorkflowNode, key: string = 'leadsWithEmail'): EmailRecipient[] {
  const metadataLeads = (node.data as any)?.metadata?.[key];
  if (!Array.isArray(metadataLeads)) return [];

  const mapped = metadataLeads.map((lead: any) => ({
    email: lead?.email,
    name: lead?.name,
  }));

  return dedupeRecipients(mapped);
}

function normalizeEmailSequence(input: any): EmailTemplate[] {
  const candidates: any[] = Array.isArray(input)
    ? input
    : Array.isArray(input?.sequence)
      ? input.sequence
      : Array.isArray(input?.emails)
        ? input.emails
        : input
          ? [input]
          : [];

  return candidates
    .map((item) => {
      const subject = String(item?.subject || '').trim();
      const html = String(item?.html || '').trim();
      const text = String(item?.text || '').trim();
      if (!subject || !html) return null;
      return {
        subject,
        html,
        text: text || undefined,
      } as EmailTemplate;
    })
    .filter(Boolean) as EmailTemplate[];
}

export async function POST(request: Request) {
  const startTime = Date.now();
  let session: any = null;
  let response: Response | null = null;
  let error: Error | null = null;
  let requestPayload: any = null;
  let executionSummary: Record<string, any> = {};
  let runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let workflowRunId = '';

  try {
    await ensureObservabilityFolders();
    session = await getServerSession(authOptions as any);
    requestPayload = await request.json();
    const { nodeId, nodes, edges, brief, strategy } = requestPayload;
    workflowRunId = String(requestPayload?.workflowRunId || `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    runId = `run_${String(nodeId || 'node')}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    executionSummary = {
      runId,
      workflowRunId,
      nodeId,
      nodeCount: Array.isArray(nodes) ? nodes.length : 0,
      edgeCount: Array.isArray(edges) ? edges.length : 0,
    };
    console.log('[agent-run] start', executionSummary);
    appendObservabilityLog('unified-executor', {
      event: 'node_execution_started',
      ...executionSummary,
    });

    // Validate input
    if (!nodeId || !nodes || !edges || !brief || !strategy) {
      response = NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
      return response;
    }

    // Build execution context
    // Get user's KYC student profile from session
    let kyc: Record<string, any> | undefined = undefined;
    try {
      const session: any = await getServerSession(authOptions as any);
      if (session?.user?.id) {
        await dbConnect();
        const user = await (User as any).findById(session.user.id).select('studentProfile');
        if (user?.studentProfile) {
          kyc = user.studentProfile.toObject?.() || user.studentProfile;
        }
      }
    } catch {}

    const context = buildExecutionContext(
      nodeId,
      nodes as WorkflowNode[],
      edges as WorkflowEdge[],
      brief,
      strategy,
      kyc
    );

    // If email node has no explicit incoming edge context, auto-attach completed node outputs
    // so the email content can still use upstream strategy/research/copy information.
    if (context.nodeType === 'email' && context.incomingEdges.length === 0) {
      const fallbackContexts = (nodes as WorkflowNode[])
        .filter(n => n.id !== nodeId && n.data?.status === 'complete' && !!n.data?.output)
        .slice(0, 4)
        .map(n => ({
          sourceNodeId: n.id,
          sourceOutput: String(n.data.output),
          transferLogic: 'Auto-fallback context from completed upstream node output.',
          edgeLabel: `Auto Context (${n.data?.label || n.id})`,
        }));

      if (fallbackContexts.length > 0) {
        context.incomingEdges.push(...fallbackContexts);
      }
    }
    executionSummary.nodeType = context.nodeType;

    // Compile the final prompt
    let finalPrompt = compilePrompt(context);
    appendObservabilityLog('ai-sdk-executor', {
      event: 'prompt_compiled',
      runId,
      workflowRunId,
      nodeId,
      nodeType: context.nodeType,
      promptLength: finalPrompt.length,
      incomingEdgeCount: context.incomingEdges.length,
    });
    appendObservabilityLog('ai-provider', {
      event: 'model_execution_requested',
      runId,
      workflowRunId,
      nodeId,
      nodeType: context.nodeType,
    });

    // Exa.ai Web Research node - searches web then analyzes with Gemini
    if (context.nodeType === 'exa_research') {
      try {
        // Get filter options from node data (checkboxes)
        const node = (nodes as WorkflowNode[]).find(n => n.id === nodeId);
        const nodeData = node?.data as any;
        const filters = {
          studentLeads: nodeData?.filters?.studentLeads !== false, // Default true
          linkedInProfiles: nodeData?.filters?.linkedInProfiles !== false,
          communities: nodeData?.filters?.communities !== false,
          competitors: nodeData?.filters?.competitors !== false,
          redditUsers: nodeData?.filters?.redditUsers !== false,
        };
        
        console.log('[exa_research] Active filters:', filters);

        // Step 1: Build COMPREHENSIVE search queries
        const queryModel = getFlashModel();
        const queryPrompt = `You are a Lead Generation Expert for Fateh Education (overseas education consultancy).

Campaign Brief: ${brief}
Strategy: ${strategy}

Generate EXACTLY 6 HIGHLY TARGETED search queries to find REAL people with ACTUAL contact information:

1. **Student Leads on Reddit** - Find students actively asking for help
   "site:reddit.com (scholarship OR UK university OR masters abroad OR study in UK) Indian student 2025 2026"

2. **LinkedIn Alumni/Professionals** - UK university graduates from India
   "site:linkedin.com/in (MSc OR MBA OR Masters) (UK OR London OR Russell Group) Indian"

3. **LinkedIn Education Consultants** - Competitors to analyze
   "site:linkedin.com/in (education consultant OR study abroad advisor) UK India"

4. **Reddit Study Abroad Communities** - For market research
   "site:reddit.com/r (studyabroad OR Indians_StudyAbroad OR UniUK OR ukvisa)"

5. **Competitor Websites** - With contact info
   "(overseas education consultant OR UK admission consultant) India contact email phone +91"

6. **High-Intent Student Posts** - Students seeking specific guidance
   "site:reddit.com scholarship UK university Indian student need help advice"

Return ONLY a JSON array of 6 query strings.`;

        const queryResponse = await generateWithRetry(queryModel, queryPrompt);
        let searchQueries: string[];
        try {
          const cleaned = queryResponse.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '');
          searchQueries = JSON.parse(cleaned);
          if (!Array.isArray(searchQueries)) throw new Error('Not an array');
        } catch {
          searchQueries = [
            'site:reddit.com (scholarship OR UK university OR masters) Indian student 2025 2026 need help',
            'site:linkedin.com/in (MSc OR MBA OR Masters) (UK OR London OR Imperial OR LSE) Indian',
            'site:linkedin.com/in (education consultant OR study abroad advisor) UK India',
            'site:reddit.com/r (studyabroad OR Indians_StudyAbroad OR UniUK OR ukvisa)',
            '(overseas education consultant OR UK admission) India contact email +91',
            'site:reddit.com UK university scholarship Indian student advice funding',
          ];
        }

        console.log('[exa_research] Search queries:', searchQueries);

        // Step 2: Execute searches with maximum results
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        
        const searchRes = await fetch(`${baseUrl}/api/campaign/exa-research`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            queries: searchQueries,
            numResults: 20, // Get more results per query
            includeText: true
          }),
        });
        const searchData = await searchRes.json();

        const allResults = searchData.results || [];
        const allTraces = searchData.toolTrace || [];

        console.log(`[exa_research] Total Exa results: ${allResults.length}`);

        // Step 3: Process and categorize ALL results with DETAILED notes
        const processedResults = allResults.map((r: any, i: number) => {
          const extractedData = r.extractedData || {};
          const highlights = (r.highlights || []).join(' ');
          const text = r.text || '';
          const url = r.url || '';
          const title = r.title || '';
          const titleLower = title.toLowerCase();
          
          // Determine TYPE based on URL and content
          let type: 'Student Lead' | 'LinkedIn Profile' | 'Community' | 'Competitor' | 'Reddit User';
          
          const isLinkedIn = url.includes('linkedin.com/in/');
          const isReddit = url.includes('reddit.com');
          const isRedditCommunity = isReddit && url.match(/reddit\.com\/r\/[^/]+\/?$/);
          const isRedditPost = isReddit && url.includes('/comments/');
          const isCompetitorSite = !isLinkedIn && !isReddit && (
            titleLower.includes('consultant') || 
            titleLower.includes('education') ||
            titleLower.includes('abroad') ||
            url.includes('contact')
          );

          // Categorize
          if (isRedditPost) {
            // Check if it's a student seeking help
            const content = (highlights + ' ' + title).toLowerCase();
            const isStudentLead = content.includes('help') || content.includes('advice') || 
                                  content.includes('scholarship') || content.includes('confused') ||
                                  content.includes('want to study') || content.includes('planning') ||
                                  content.includes('need guidance') || content.includes('which university');
            type = isStudentLead ? 'Student Lead' : 'Reddit User';
          } else if (isRedditCommunity) {
            type = 'Community';
          } else if (isLinkedIn) {
            // Check if it's an education professional (competitor) or potential lead
            const isEducationPro = titleLower.includes('consultant') || titleLower.includes('advisor') ||
                                   titleLower.includes('counselor') || titleLower.includes('founder');
            type = isEducationPro ? 'Competitor' : 'LinkedIn Profile';
          } else if (isCompetitorSite) {
            type = 'Competitor';
          } else {
            type = 'Reddit User';
          }

          // Extract NAME
          let name = '';
          if (isLinkedIn) {
            // Extract from LinkedIn URL or title
            const urlMatch = url.match(/linkedin\.com\/in\/([^/?]+)/);
            if (urlMatch) {
              name = urlMatch[1].split('-').filter((p: string) => isNaN(Number(p))).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
            }
            if (!name && title) {
              name = title.split(' - ')[0].split(' | ')[0].trim();
            }
          } else if (isReddit) {
            // Extract Reddit username
            const userMatch = title.match(/u\/([a-zA-Z0-9_-]+)/) || url.match(/user\/([a-zA-Z0-9_-]+)/) || url.match(/comments\/[^/]+\/([^/]+)/);
            if (userMatch) {
              name = 'u/' + userMatch[1].substring(0, 15);
            } else if (isRedditCommunity) {
              const subMatch = url.match(/reddit\.com\/r\/([^/]+)/);
              name = subMatch ? 'r/' + subMatch[1] : title.substring(0, 30);
            } else {
              name = title.substring(0, 40);
            }
          } else {
            name = title.substring(0, 50);
          }

          // Extract CONTACT INFO
          const emails = extractedData.emails || [];
          const phones = extractedData.phones || [];
          let contactInfo = '';
          
          if (emails.length > 0) {
            contactInfo = emails[0];
          } else if (phones.length > 0) {
            contactInfo = phones[0];
          } else if (isLinkedIn && name) {
            // Try to infer email pattern
            const nameParts = name.toLowerCase().split(' ').filter(p => p.length > 1);
            if (nameParts.length >= 2) {
              contactInfo = `${nameParts[0]}.${nameParts[1]}@gmail.com (inferred)`;
            }
          }

          // Calculate RELEVANCE SCORE (0-100)
          let score = 50;
          const content = (highlights + ' ' + text + ' ' + title).toLowerCase();
          
          // Boost for student-related content
          if (content.includes('scholarship')) score += 15;
          if (content.includes('uk university') || content.includes('uk education')) score += 10;
          if (content.includes('masters') || content.includes('mba') || content.includes('msc')) score += 10;
          if (content.includes('indian student') || content.includes('from india')) score += 10;
          if (content.includes('help') || content.includes('advice') || content.includes('guidance')) score += 10;
          if (content.includes('ielts') || content.includes('pte')) score += 5;
          if (content.includes('visa')) score += 5;
          
          // Boost for having contact info
          if (emails.length > 0) score += 15;
          if (phones.length > 0) score += 10;
          
          // Type-based adjustments
          if (type === 'Student Lead') score += 10;
          if (type === 'Community') score = Math.max(score - 10, 40);
          
          score = Math.min(score, 100);

          // Generate DETAILED NOTES
          let notes = '';
          if (type === 'Student Lead') {
            if (content.includes('scholarship')) {
              notes = `HOT LEAD - actively seeking scholarships due to financial need. Perfect for scholarship guidance.`;
            } else if (content.includes('confused') || content.includes('help')) {
              notes = `Student seeking guidance on study abroad process. High-potential future lead for ${new Date().getFullYear()}+.`;
            } else if (content.includes('visa')) {
              notes = `Student experiencing visa-related concerns. Highlights a key pain point for target audience.`;
            } else if (content.includes('funding')) {
              notes = `PhD/Masters candidate looking for funding options. Target for financial strategy messaging.`;
            } else {
              notes = `Student interested in UK education. Shows intent for study abroad counselling.`;
            }
          } else if (type === 'LinkedIn Profile') {
            if (content.includes('mba') || content.includes('masters') || content.includes('msc')) {
              notes = `Successful alumnus with UK degree. Ideal for testimonial and success story content.`;
            } else if (content.includes('phd') || content.includes('researcher')) {
              notes = `PhD researcher at UK university. Represents the STEM research pathway.`;
            } else {
              notes = `UK-educated professional. Good example of graduate success story.`;
            }
          } else if (type === 'Community') {
            if (url.includes('Indians_StudyAbroad')) {
              notes = `A dedicated subreddit for Indian students studying abroad. Prime location for market research and soft engagement.`;
            } else if (url.includes('ukvisa')) {
              notes = `Highly active community focused on UK visa issues. Essential for understanding visa processing challenges.`;
            } else if (url.includes('UniUK')) {
              notes = `Community for UK university students. Useful for insights into campus life and student satisfaction.`;
            } else if (url.includes('studyAbroad')) {
              notes = `Large, general community for study abroad topics. Good for understanding broad student concerns.`;
            } else {
              notes = `Relevant community for market research and trend monitoring.`;
            }
          } else if (type === 'Competitor') {
            if (emails.length > 0 || phones.length > 0) {
              notes = `Competitor with ${emails.length > 0 ? 'email' : 'phone'} contact. Monitor for competitive intelligence.`;
            } else if (isLinkedIn) {
              notes = `Founder/Director of competitor consultancy. Key profile to monitor for competitive intelligence.`;
            } else {
              notes = `Competitor offering similar services. Their website provides insights into service offerings and messaging.`;
            }
          } else {
            notes = `User engaging with study abroad content. Potential lead with further qualification.`;
          }

          return {
            name: name || 'Unknown',
            type,
            sourceUrl: url,
            relevance: score,
            contactInfo: contactInfo || 'See URL',
            notes,
            // Extra data for filtering
            emails,
            phones,
            isLinkedIn,
            isReddit,
            isRedditCommunity: !!isRedditCommunity,
            isCompetitor: type === 'Competitor',
            isStudentLead: type === 'Student Lead',
          };
        });

        // Sort by relevance
        processedResults.sort((a: any, b: any) => b.relevance - a.relevance);

        // Step 4: Apply filters and separate into categories
        const studentLeads = processedResults.filter((r: any) => r.type === 'Student Lead');
        const linkedInProfiles = processedResults.filter((r: any) => r.type === 'LinkedIn Profile');
        const communities = processedResults.filter((r: any) => r.type === 'Community');
        const competitors = processedResults.filter((r: any) => r.type === 'Competitor');
        const redditUsers = processedResults.filter((r: any) => r.type === 'Reddit User');

        // Step 5: Build CSV based on filters - WITH Email column for email agent
        const csvHeader = 'Name,Type,Source URL,Relevance,Email,Phone,Contact Info,Notes';
        let csvRows: string[] = [];
        
        const buildCsvRow = (r: any) => {
          const email = r.emails && r.emails.length > 0 ? r.emails[0] : '';
          const phone = r.phones && r.phones.length > 0 ? r.phones[0] : '';
          return `"${r.name}","${r.type}","${r.sourceUrl}","${r.relevance}","${email}","${phone}","${r.contactInfo}","${r.notes.replace(/"/g, '""')}"`;
        };
        
        if (filters.studentLeads) {
          studentLeads.forEach((r: any) => csvRows.push(buildCsvRow(r)));
        }
        if (filters.linkedInProfiles) {
          linkedInProfiles.forEach((r: any) => csvRows.push(buildCsvRow(r)));
        }
        if (filters.communities) {
          communities.forEach((r: any) => csvRows.push(buildCsvRow(r)));
        }
        if (filters.competitors) {
          competitors.forEach((r: any) => csvRows.push(buildCsvRow(r)));
        }
        if (filters.redditUsers) {
          redditUsers.forEach((r: any) => csvRows.push(buildCsvRow(r)));
        }

        // Sort CSV by relevance
        csvRows.sort((a, b) => {
          const scoreA = parseInt(a.match(/"(\d+)"/g)?.[1]?.replace(/"/g, '') || '0');
          const scoreB = parseInt(b.match(/"(\d+)"/g)?.[1]?.replace(/"/g, '') || '0');
          return scoreB - scoreA;
        });

        const fullCSV = csvHeader + '\n' + csvRows.join('\n');

        const sendableLeads = processedResults.filter((r: any) => {
          const type = String(r.type || '').toLowerCase();
          return !EXCLUDED_BROADCAST_TYPES.has(type);
        });
        const emailableStudentLeads = studentLeads.filter((r: any) => r.emails && r.emails.length > 0);
        const emailableSendableLeads = sendableLeads.filter((r: any) => r.emails && r.emails.length > 0);
        const topContactableLeads = sendableLeads
          .filter((r: any) => (r.emails && r.emails.length > 0) || (r.phones && r.phones.length > 0))
          .slice(0, 15);

        const topContactsTable = topContactableLeads.length > 0
          ? ['| Rank | Name | Type | Score | Email | Phone | Source |', '|---|---|---|---:|---|---|---|']
              .concat(
                topContactableLeads.map((r: any, index: number) => `| ${index + 1} | ${String(r.name).replace(/\|/g, ' ')} | ${r.type} | ${r.relevance} | ${r.emails?.[0] || '-'} | ${r.phones?.[0] || '-'} | [link](${r.sourceUrl}) |`)
              )
              .join('\n')
          : 'No contactable leads found in this batch.';

        // Step 6: Generate Gemini analysis with stricter formatting and practical recommendations
        const analysisPrompt = `You are a senior lead-generation strategist for Fateh Education. Return concise actionable markdown.

DATA:
- Total results: ${processedResults.length}
- Student leads: ${studentLeads.length}
- Sendable leads (excluding competitors/communities): ${sendableLeads.length}
- Student leads with email: ${emailableStudentLeads.length}
- Sendable leads with email: ${emailableSendableLeads.length}

TOP CONTACTABLE LEADS:
${topContactableLeads.slice(0, 10).map((r: any, i: number) => `${i + 1}. ${r.name} | ${r.type} | score ${r.relevance} | email ${r.emails?.[0] || '-'} | phone ${r.phones?.[0] || '-'}`).join('\n') || 'None'}

OUTPUT RULES:
1) Start with heading "### Strategic Analysis"
2) Provide exactly 4 bullet insights
3) Provide heading "### Priority Actions (Next 7 Days)"
4) Provide exactly 5 numbered actions
5) Keep practical, no fluff, no apology text.`;

        const textModel = getFlashModel();
        const analysis = await generateWithRetry(textModel, analysisPrompt);

        // Step 7: Build comprehensive output
        const traceList = allTraces.map((t: string) => `- ${t}`).join('\n');
        const emailLeadsList = emailableSendableLeads.map((r: any) =>
          `- ${r.name} (${r.type}): ${r.emails[0]} (score ${r.relevance})`
        ).join('\n') || 'No sendable leads with verified emails found.';

        const leadsWithEmailCount = emailableStudentLeads.length;
        const sendableEmailCount = emailableSendableLeads.length;
        const leadsWithPhoneCount = studentLeads.filter((r: any) => r.phones && r.phones.length > 0).length;
        const highPriorityCount = sendableLeads.filter((r: any) => r.relevance >= 85).length;

        const output = `## 🔍 Lead Research Report

### 🛠️ Search Queries Executed
${traceList}

### 📊 Results Overview
| Category | Count |
|----------|-------|
| **Student Leads** | **${studentLeads.length}** |
| LinkedIn Profiles | ${linkedInProfiles.length} |
| Communities | ${communities.length} |
| Competitors | ${competitors.length} |
| Reddit Users | ${redditUsers.length} |
| **Total** | **${processedResults.length}** |

### ✅ Data Quality Snapshot
- Student leads with verified email: ${leadsWithEmailCount}
- Sendable leads with verified email (excl. competitor/community): ${sendableEmailCount}
- Student leads with phone numbers: ${leadsWithPhoneCount}
- High-priority leads (score 85+): ${highPriorityCount}
- CSV rows exported after filters: ${csvRows.length}

### 🔥 Top Contactable Leads Table
${topContactsTable}

### 📈 Analysis
${analysis}

---

### 📥 FULL CSV DATA (${csvRows.length} rows)
\`\`\`csv
${fullCSV}
\`\`\`

---

### 📧 Leads Ready for Email Outreach
${emailLeadsList}

### 🧭 Recommended Next Steps
- Run Email node on connected output immediately.
- Use sendable leads table (excluding competitors/communities) as send source.
- Run another research batch with alternate intent keywords to improve yield.
`;

        // Store both strict-student and broader sendable leads for Email node
        const emailableLeads = emailableStudentLeads;
        const snapshotResult = await saveWebResearchSnapshot({
          runId,
          workflowRunId,
          nodeId,
          createdAt: new Date().toISOString(),
          csv: fullCSV,
          leadsWithEmail: emailableSendableLeads.map((r: any) => ({
            name: r.name,
            email: r.emails[0],
            score: r.relevance,
          })),
          summary: {
            totalResults: processedResults.length,
            studentLeads: studentLeads.length,
            emailableLeads: emailableLeads.length,
            emailableSendableLeads: emailableSendableLeads.length,
            filters,
          },
        });

        appendObservabilityLog('agents', {
          event: 'web_research_completed',
          runId,
          workflowRunId,
          nodeId,
          nodeType: 'exa_research',
          totalResults: processedResults.length,
          studentLeads: studentLeads.length,
          emailableLeads: emailableLeads.length,
          emailableSendableLeads: emailableSendableLeads.length,
          csvRows: csvRows.length,
          cachePath: snapshotResult.latestPath,
        });

        response = NextResponse.json({
          success: true,
          output,
          nodeId,
          metadata: {
            runId,
            workflowRunId,
            nodeType: 'exa_research',
            totalResults: processedResults.length,
            studentLeads: studentLeads.length,
            emailableLeads: emailableLeads.length,
            emailableSendableLeads: emailableSendableLeads.length,
            cachePath: snapshotResult.latestPath,
            studentLeadsWithEmail: emailableLeads.map((r: any) => ({
              name: r.name,
              email: r.emails[0],
              score: r.relevance,
            })),
            allLeadsWithEmail: emailableSendableLeads.map((r: any) => ({
              name: r.name,
              email: r.emails[0],
              score: r.relevance,
            })),
            leadsWithEmail: emailableSendableLeads.map((r: any) => ({
              name: r.name,
              email: r.emails[0],
              score: r.relevance,
            })),
          },
        });
        return response;
      } catch (err: any) {
        console.error('[exa_research] Error:', err);
        response = NextResponse.json({
          success: true,
          output: `⚠️ Web research failed: ${err.message}. Please try again.`,
          nodeId,
        });
        return response;
      }
    }

    // LinkedIn and Twitter node integration - generate content first, then post
    if (context.nodeType === 'linkedin' || context.nodeType === 'twitter') {
      const textModel = getFlashModel();
      try {
        // Generate the post content using AI
        const generatedContent = await generateWithRetry(textModel, finalPrompt);
        let postText = generatedContent.trim();
        
        // Enforce character limits
        const limits = { linkedin: 2800, twitter: 270 };
        const limit = limits[context.nodeType as 'linkedin' | 'twitter'];
        if (postText.length > limit) {
          console.warn(`[${context.nodeType}] Content too long (${postText.length} chars), truncating to ${limit}`);
          postText = postText.substring(0, limit - 3) + '...';
        }
        
        console.log(`[${context.nodeType}] Generated content (${postText.length} chars):`, postText.substring(0, 100));
        
        // Extract images from previous nodes (image node output)
        let imageUrls: string[] = [];
        for (const node of nodes) {
          if (node.data?.output && typeof node.data.output === 'string') {
            try {
              const parsed = JSON.parse(node.data.output);
              if (parsed.images && Array.isArray(parsed.images)) {
                // Get first 9 image URLs (LinkedIn supports up to 9)
                imageUrls = parsed.images.slice(0, 9).map((img: any) => {
                  const url = img.url || img;
                  // Cloudinary URLs are absolute, no conversion needed
                  // Only convert relative URLs to absolute for backward compatibility
                  if (typeof url === 'string' && url.startsWith('/')) {
                    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
                    return `${baseUrl}${url}`;
                  }
                  return url;
                });
                break;
              }
            } catch (e) {
              // Not JSON or no images, continue
            }
          }
        }
        
        console.log(`[${context.nodeType}] Found ${imageUrls.length} images to attach`);

        // Resolve connected social token from the current authenticated user.
        // execute-node calls post routes server-to-server, so cookies/session are not automatically forwarded.
        let userSocialToken: string | undefined;
        try {
          if (session?.user?.id) {
            await dbConnect();
            const socialUser = await (User as any)
              .findById(session.user.id)
              .select('+socialTokens.twitter.access_token +socialTokens.linkedin.access_token')
              .lean();

            if (context.nodeType === 'twitter') {
              userSocialToken = socialUser?.socialTokens?.twitter?.access_token;
            } else {
              userSocialToken = socialUser?.socialTokens?.linkedin?.access_token;
            }

            console.log(`[${context.nodeType}] User social token present: ${!!userSocialToken}`);
          }
        } catch (tokenErr) {
          console.warn(`[${context.nodeType}] Failed to resolve user social token:`, tokenErr);
        }
        
        // Post to the social platform using app credentials
        const apiEndpoint = context.nodeType === 'linkedin' ? '/api/linkedin/post' : '/api/twitter/post';
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const postPayload: any = { text: postText, imageUrls };
        if (userSocialToken) {
          postPayload.access_token = userSocialToken;
        } else {
          console.warn(`[${context.nodeType}] No user social token found, falling back to app-level credentials.`);
        }
        
        console.log(`[${context.nodeType}] Attempting to post to ${baseUrl}${apiEndpoint}`);
        
        const postRes = await fetch(`${baseUrl}${apiEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postPayload),
        });
        
        const postData = await postRes.json();
        console.log(`[${context.nodeType}] Post response:`, postData);
        
        if (!postRes.ok || !postData.success) {
          const is503 = postData.details?.status === 503 || postRes.status === 503;
          const errorMsg = is503 
            ? `⚠️ X/Twitter API is experiencing server issues (503 Service Unavailable). This is a known platform-wide issue. Your content was generated and is ready — you can copy and post it manually.`
            : `⚠️ Failed to post: ${postData.error || 'Unknown error'}. ${JSON.stringify(postData.details || {})}`;
          
          response = NextResponse.json({ 
            success: true, 
            output: `📝 Generated ${context.nodeType === 'twitter' ? 'Tweet' : 'LinkedIn Post'}:\n\n${postText}\n\n${errorMsg}`,
            nodeId 
          });
          return response;
        }
        
        response = NextResponse.json({ 
          success: true, 
          output: `✅ Successfully posted to ${context.nodeType === 'linkedin' ? 'LinkedIn' : 'Twitter'}!\n\n${postText}${imageUrls.length > 0 ? `\n\n📸 With ${imageUrls.length} image(s)` : ''}`,
          nodeId 
        });
        return response;
      } catch (err) {
        error = err as Error;
        console.error('Social media posting failed:', error);
        response = NextResponse.json({ 
          success: true, 
          output: `Content generation or posting failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          nodeId 
        });
        return response;
      }
    }

    // Email node integration - generate email content, then send to CSV list
    if (context.nodeType === 'email') {
      const textModel = getFlashModel();
      try {
        if (context.incomingEdges.length === 0) {
          const autoContextNodes = (nodes as WorkflowNode[])
            .filter((n) => n.id !== nodeId && n.data?.status === 'complete' && typeof n.data?.output === 'string' && n.data.output.trim())
            .slice(-2);

          if (autoContextNodes.length > 0) {
            finalPrompt += `\n\nAUTO-CONTEXT (derived from latest completed workflow nodes):\n`;
            for (const sourceNode of autoContextNodes) {
              finalPrompt += `\n--- ${sourceNode.data?.label || sourceNode.id} (${sourceNode.data?.type || 'node'}) ---\n`;
              finalPrompt += `${String(sourceNode.data?.output || '').substring(0, 2500)}\n`;
            }
          }
        }

        // Generate the email content using AI
        console.log('[email] Generating email content with AI...');
        const generatedContent = await generateWithRetry(textModel, finalPrompt);
        
        console.log('[email] Raw AI response (first 500 chars):', generatedContent.substring(0, 500));
        
        // Parse JSON response with better error handling
        let emailData;
        let emailSequence: EmailTemplate[] = [];
        try {
          // Remove markdown code blocks if present
          let cleanedContent = generatedContent.trim();
          
          // Remove ```json and ``` markers
          cleanedContent = cleanedContent.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
          
          // Try parsing full JSON first (array or object)
          let parsedPayload: any = null;
          try {
            parsedPayload = JSON.parse(cleanedContent);
          } catch {
            // Fallback to extracting JSON object if the model included prose
            const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedPayload = JSON.parse(jsonMatch[0]);
            }
          }

          if (parsedPayload) {
            emailSequence = normalizeEmailSequence(parsedPayload);
            emailData = emailSequence[0] || null;
            console.log('[email] Successfully parsed JSON from AI response');
            console.log('[email] Parsed data:', {
              sequenceCount: emailSequence.length,
              subject: emailData?.subject?.substring(0, 50),
              htmlPreview: emailData?.html?.substring(0, 100),
              textPreview: emailData?.text?.substring(0, 100),
            });
          } else {
            throw new Error('No JSON object found in response');
          }
          
          // Validate and ensure required fields exist with content
          if (!emailData?.subject || typeof emailData.subject !== 'string' || emailData.subject.trim().length === 0) {
            throw new Error('Missing or empty subject field');
          }
          
          if (!emailData?.html || typeof emailData.html !== 'string' || emailData.html.trim().length === 0) {
            throw new Error('Missing or empty html field');
          }
          
          // Clean up any unwanted placeholders (except {{name}})
          const cleanPlaceholders = (text: string) => {
            return text
              // Remove common placeholder patterns except {{name}}
              .replace(/\{\{(?!name\}\})[^}]+\}\}/g, '')
              .replace(/\[Your [^\]]+\]/gi, 'our')
              .replace(/\[Product [^\]]+\]/gi, 'our product')
              .replace(/\[Company [^\]]+\]/gi, 'our team')
              .replace(/\[Link [^\]]+\]/gi, '[link]')
              .replace(/\[.*?\]/g, '') // Remove any other bracketed placeholders
              // Clean up double spaces
              .replace(/\s{2,}/g, ' ')
              .trim();
          };
          
          emailData.subject = cleanPlaceholders(emailData.subject);
          emailData.html = cleanPlaceholders(emailData.html);

          emailSequence = emailSequence.map((template) => ({
            ...template,
            subject: cleanPlaceholders(template.subject),
            html: cleanPlaceholders(template.html),
            text: template.text ? cleanPlaceholders(template.text) : undefined,
          }));
          
          // Ensure text version exists
          if (!emailData.text || typeof emailData.text !== 'string' || emailData.text.trim().length === 0) {
            console.warn('[email] No text version provided, generating from HTML');
            emailData.text = emailData.html
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          } else {
            emailData.text = cleanPlaceholders(emailData.text);
          }
          
        } catch (parseError) {
          console.error('[email] JSON parsing failed:', parseError);
          console.error('[email] Attempting intelligent content generation...');
          
          // Extract useful information from campaign context
          const cleanContent = generatedContent
            .replace(/```json?/gi, '')
            .replace(/```/g, '')
            .trim();
          
          // Try to extract subject from AI response
          const subjectMatch = cleanContent.match(/"subject"\s*:\s*"([^"]+)"/i) || 
                              cleanContent.match(/subject:\s*["']?([^\n"']+)["']?/i);
          let extractedSubject = subjectMatch ? subjectMatch[1].trim() : null;
          
          // Analyze the campaign brief to extract context
          const briefLower = brief.toLowerCase();
          let serviceType = 'our study abroad counselling';
          let benefits: string[] = [];
          
          // Extract service type from brief
          if (briefLower.includes('ielts') || briefLower.includes('pte')) serviceType = 'our IELTS/PTE training programs';
          else if (briefLower.includes('scholarship')) serviceType = 'our scholarship guidance services';
          else if (briefLower.includes('visa')) serviceType = 'our visa assistance services';
          else if (briefLower.includes('uk')) serviceType = 'our UK university placement services';
          else if (briefLower.includes('ireland')) serviceType = 'our Ireland university placement services';
          else if (briefLower.includes('counselling') || briefLower.includes('counseling')) serviceType = 'our expert education counselling';
          
          // Extract benefits from brief and strategy
          const benefitKeywords = [
            'scholarship', 'placement', 'university', 'career', 'affordable', 'expert',
            'guidance', 'support', 'visa', 'training', 'counselling', 'personalized',
            'global', 'opportunity', 'admission', 'guaranteed'
          ];
          
          const combinedText = (brief + ' ' + strategy).toLowerCase();
          benefitKeywords.forEach(keyword => {
            if (combinedText.includes(keyword)) {
              benefits.push(keyword);
            }
          });
          
          // If no benefits found, use education-focused defaults
          if (benefits.length === 0) {
            benefits = ['expert guidance', 'global opportunities', 'personalized support'];
          }
          
          // Limit to top 3 benefits
          benefits = benefits.slice(0, 3);
          
          // Generate compelling subject line
          let subject: string;
          if (extractedSubject && extractedSubject.length > 15 && !extractedSubject.includes('campaign')) {
            subject = extractedSubject;
          } else {
            const subjectTemplates = [
              `Your Study Abroad Dream Starts Here — Free Counselling Inside`,
              `Exclusive: Expert Guidance for UK & Ireland Universities`,
              `Limited Spots: Get ${benefits[0]} for Your Study Abroad Journey`,
              `You've Been Selected: Personalized University Placement Awaits`,
              `Don't Miss Out: ${benefits[0].charAt(0).toUpperCase() + benefits[0].slice(1)} for Your Future`,
            ];
            subject = subjectTemplates[Math.floor(Math.random() * subjectTemplates.length)];
          }
          
          // Ensure subject is reasonable length
          if (subject.length > 70) {
            subject = subject.substring(0, 67) + '...';
          }
          
          // Build email body paragraphs
          const paragraph1 = `Are you dreaming of studying abroad and looking for ${benefits.map((b, i) => i === benefits.length - 1 && benefits.length > 1 ? `and ${b}` : b).join(', ')}? You're in the right place. At Fateh Education, we've helped over 45,000 students turn their overseas education dreams into reality.`;
          
          const paragraph2 = `What makes us different? With 120+ partner universities across the UK and Ireland, ${benefits[0]} from experienced counsellors, and end-to-end ${benefits[1] || 'application support'} — from IELTS preparation to visa assistance — we've got every step of your journey covered.`;
          
          const paragraph3 = `Join thousands of successful students who have already secured their future with our help. Book a free counselling session today and take the first step toward your global career.`;
          
          // Build HTML email
          const htmlContent = `<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;'>
  <h1 style='color: #333333; font-size: 24px; margin-bottom: 20px; font-weight: 600;'>Hello {{name}},</h1>
  
  <p style='color: #666666; font-size: 16px; line-height: 1.6; margin-bottom: 15px;'>
    ${paragraph1}
  </p>
  
  <p style='color: #666666; font-size: 16px; line-height: 1.6; margin-bottom: 15px;'>
    ${paragraph2}
  </p>
  
  <p style='color: #666666; font-size: 16px; line-height: 1.6; margin-bottom: 25px;'>
    ${paragraph3}
  </p>
  
  <div style='margin: 30px 0; text-align: center;'>
    <a href='#' style='background-color: #0066cc; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 2px 4px rgba(0,102,204,0.3);'>
      Book Free Counselling
    </a>
  </div>
  
  <div style='margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee;'>
    <p style='color: #999999; font-size: 14px; line-height: 1.5; margin-bottom: 10px;'>
      Thank you for considering Fateh Education. We're committed to your success.
    </p>
    <p style='color: #666666; font-size: 14px; margin-top: 15px;'>
      Best regards,<br>
      <strong>The Team</strong>
    </p>
  </div>
</div>`;
          
          // Generate text version
          const textContent = `Hello {{name}},

${paragraph1}

${paragraph2}

${paragraph3}

Book Free Counselling: [link]

---

Thank you for considering Fateh Education. We're committed to your success.

Best regards,
Team Fateh Education`;
          
          emailData = {
            subject,
            html: htmlContent,
            text: textContent,
          };
          emailSequence = [emailData];
          
          console.log('[email] Intelligent fallback email generated:', {
            subject,
            serviceType,
            benefits: benefits.join(', '),
            htmlLength: htmlContent.length,
            textLength: textContent.length,
          });
        }

        console.log('[email] Final email data ready:', {
          subject: emailData.subject,
          sequenceCount: emailSequence.length,
          htmlLength: emailData.html?.length || 0,
          textLength: emailData.text?.length || 0,
          htmlPreview: emailData.html?.substring(0, 150),
        });

        // 1) Node manual recipient list (uploaded CSV), 2) connected Web Research nodes, 3) local cache fallback
        const node = (nodes as WorkflowNode[]).find(n => n.id === nodeId);
        const initialManualList = Array.isArray((node?.data as any)?.emailList)
          ? ((node?.data as any)?.emailList as EmailRecipient[])
          : [];

        const incomingSourceNodeIds = (edges as WorkflowEdge[])
          .filter(edge => edge.target === nodeId)
          .map(edge => edge.source);

        const webResearchNodes = (nodes as WorkflowNode[]).filter(n => {
          const nodeType = n.data?.type || n.type;
          return nodeType === 'exa_research' && n.data?.status === 'complete';
        });

        const incomingResearchNodes = webResearchNodes.filter(n => incomingSourceNodeIds.includes(n.id));
        const allResearchNodes = webResearchNodes;
        const preferredResearchNodes = incomingResearchNodes.length > 0 ? incomingResearchNodes : allResearchNodes;

        const cachedSnapshots = await Promise.all(
          preferredResearchNodes.map(sourceNode => readLatestWebResearchSnapshot(sourceNode.id))
        );

        const cacheRecipientsBroad = dedupeRecipients(
          cachedSnapshots.flatMap(snapshot => {
            if (!snapshot || !Array.isArray(snapshot.leadsWithEmail)) return [];
            return snapshot.leadsWithEmail.map((lead: any) => ({
              email: lead?.email,
              name: lead?.name,
            }));
          })
        );

        const metadataRecipientsStrict = dedupeRecipients(
          preferredResearchNodes.flatMap(node => extractRecipientsFromNodeMetadata(node, 'studentLeadsWithEmail'))
        );

        const metadataRecipientsBroad = dedupeRecipients(
          preferredResearchNodes.flatMap(node => [
            ...extractRecipientsFromNodeMetadata(node, 'allLeadsWithEmail'),
            ...extractRecipientsFromNodeMetadata(node, 'leadsWithEmail'),
          ])
        );

        const csvRecipientsStrict = dedupeRecipients(
          preferredResearchNodes.flatMap(sourceNode => extractRecipientsFromCsvOutput(sourceNode.data.output || '', { studentOnly: true }))
        );

        const csvRecipientsBroad = dedupeRecipients(
          preferredResearchNodes.flatMap(sourceNode =>
            extractRecipientsFromCsvOutput(sourceNode.data.output || '', {
              excludeTypes: EXCLUDED_BROADCAST_TYPES,
            })
          )
        );

        const strictStudentEmailList = dedupeRecipients([
          ...initialManualList,
          ...metadataRecipientsStrict,
          ...csvRecipientsStrict,
        ]);

        const broadEmailList = dedupeRecipients([
          ...initialManualList,
          ...cacheRecipientsBroad,
          ...metadataRecipientsBroad,
          ...csvRecipientsBroad,
        ]);

        const emailList = strictStudentEmailList.length > 0 ? strictStudentEmailList : broadEmailList;
        const fallbackUsed = strictStudentEmailList.length === 0 && broadEmailList.length > 0;

        const recipientDiscovery = {
          runId,
          workflowRunId,
          sourceMode: incomingResearchNodes.length > 0 ? 'connected_nodes' : 'workflow_fallback',
          fallbackUsed,
          manualRecipients: initialManualList.length,
          connectedResearchNodes: incomingResearchNodes.length,
          totalResearchNodes: allResearchNodes.length,
          strictRecipients: strictStudentEmailList.length,
          broadRecipients: broadEmailList.length,
          cacheRecipients: cacheRecipientsBroad.length,
          metadataRecipientsStrict: metadataRecipientsStrict.length,
          metadataRecipientsBroad: metadataRecipientsBroad.length,
          csvRecipientsStrict: csvRecipientsStrict.length,
          csvRecipientsBroad: csvRecipientsBroad.length,
          finalRecipients: emailList.length,
        };

        console.log('[email] recipient discovery', recipientDiscovery);
        appendObservabilityLog('workflows', {
          event: 'email_recipients_resolved',
          nodeId,
          ...recipientDiscovery,
        });

        if (!emailList || !Array.isArray(emailList) || emailList.length === 0) {
          // Return helpful output with instructions
          const webResearchCount = (nodes as WorkflowNode[]).filter(n => (n.data?.type || n.type) === 'exa_research').length;
          const debugInfo = webResearchCount > 0 ? 
            `\n\n🔍 Found ${webResearchCount} Web Research node(s) in workflow, but no valid emails were extracted. Check the Web Research output table and cache file.` : 
            '\n\n💡 Add a Web Research node to your workflow and run it first to extract leads automatically!';
          
          response = NextResponse.json({ 
            success: true,
            output: `✉️ Email Campaign Ready!\n\n**Subject:** ${emailData.subject}\n\n⚠️ **No email recipients found**${debugInfo}\n\n**🤖 AGENTIC MODE:** This email agent automatically searches for completed Web Research outputs in your workflow - no manual connections needed!\n\n**To send this campaign:**\n1. Add a Web Research node and run it first (it will find student leads with emails)\n2. Then run this Email node - it will automatically use those leads!\n\n**Preview:**\n${emailData.text?.substring(0, 300) || emailData.html?.substring(0, 300)}...\n\n---\n📧 *Emails are sent only to Student Leads, not competitors or communities*`,
            nodeId,
            metadata: {
              ...emailData,
              recipientDiscovery,
            },
          });
          appendObservabilityLog('agents', {
            event: 'email_node_no_recipients',
            runId,
            workflowRunId,
            nodeId,
            subject: emailData.subject,
            recipientDiscovery,
          });
          return response;
        }

        // Send bulk emails
        console.log(`[email] Sending to ${emailList.length} recipients...`);
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        
        const sendRes = await fetch(`${baseUrl}/api/email/send-bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailList,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
            sequence: emailSequence,
            campaignContext: {
              runId,
              workflowRunId,
              sourceNodeId: nodeId,
              sourceNodeType: context.nodeType,
            },
          }),
        });

        const sendData = await sendRes.json();
        console.log('[email] Send result:', sendData);

        if (!sendRes.ok || !sendData.success) {
          const firstDeliveryError = Array.isArray(sendData?.errors) && sendData.errors.length > 0
            ? sendData.errors[0]
            : null;
          response = NextResponse.json({ 
            success: false,
            error: `Failed to send campaign emails: ${sendData.error || 'Unknown error'}`,
            details: {
              providerDetails: sendData.details || null,
              firstDeliveryError,
              remediation: 'Verify RESEND domain for production sending OR configure GMAIL_USER and GMAIL_APP_PASSWORD.',
            },
            nodeId,
            metadata: {
              ...emailData,
              recipientDiscovery,
            },
          }, { status: sendRes.status || 502 });
          return response;
        }

        const errorSummary = sendData.errors && sendData.errors.length > 0 
          ? `\n\n⚠️ Some emails failed (${sendData.failed}/${sendData.total}):\n${sendData.errors.slice(0, 3).join('\n')}`
          : '';
        const fallbackSummary = fallbackUsed
          ? '\n\nℹ️ No student-email rows found, so fallback recipient mode was used (excluding competitors/communities).'
          : '';

        response = NextResponse.json({ 
          success: true, 
          output: `✅ Email campaign sent successfully!\n\nSubject: ${emailData.subject}\n\n📧 Sent: ${sendData.sent}/${sendData.total} emails${sendData.sequenceLength ? ` across ${sendData.sequenceLength} sequence step(s)` : ''}${errorSummary}${fallbackSummary}\n\nRecipients: ${emailList.slice(0, 5).map((r: any) => typeof r === 'string' ? r : r.email).join(', ')}${emailList.length > 5 ? ` and ${emailList.length - 5} more...` : ''}`,
          nodeId,
          metadata: {
            ...emailData,
            sequenceLength: emailSequence.length,
            recipientDiscovery,
            sendStats: {
              sent: sendData.sent,
              failed: sendData.failed,
              total: sendData.total,
            },
          },
        });
        appendObservabilityLog('agents', {
          event: 'email_node_completed',
          runId,
          workflowRunId,
          nodeId,
          subject: emailData.subject,
          recipientDiscovery,
          sendStats: {
            sent: sendData.sent,
            failed: sendData.failed,
            total: sendData.total,
          },
        });
        return response;
      } catch (err) {
        error = err as Error;
        console.error('Email campaign failed:', error);
        response = NextResponse.json({ 
          success: true, 
          output: `Email generation or sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          nodeId 
        });
        return response;
      }
    }

    // Video node: generate visual prompts via Gemini, then trigger Veo video generation
    if (context.nodeType === 'video') {
      const textModel = getFlashModel();
      try {
        console.log('[execute-node] Starting video concept generation for node:', nodeId);
        const generatedContent = await generateWithRetry(textModel, finalPrompt);

        // Parse the visual prompts JSON
        let videoData;
        try {
          let cleanedContent = generatedContent.trim();
          cleanedContent = cleanedContent.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
          const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            videoData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON object found in response');
          }
        } catch (parseError) {
          console.error('[video] JSON parsing failed, using raw output');
          response = NextResponse.json({ success: true, output: generatedContent.trim(), nodeId });
          return response;
        }

        const rawVisualPrompts = Array.isArray(videoData.visualPrompts) ? videoData.visualPrompts : [];
        const adBeatOrder = ['hook', 'proof', 'cta'];

        const visualPrompts = rawVisualPrompts
          .slice(0, 3)
          .map((scene: any, idx: number) => {
            const adBeat = typeof scene?.adBeat === 'string'
              ? scene.adBeat.toLowerCase()
              : adBeatOrder[idx];

            const sceneName = typeof scene?.sceneName === 'string' && scene.sceneName.trim().length > 0
              ? scene.sceneName.trim()
              : `${adBeat.charAt(0).toUpperCase()}${adBeat.slice(1)} Scene ${idx + 1}`;

            const mood = typeof scene?.mood === 'string' && scene.mood.trim().length > 0
              ? scene.mood.trim()
              : (adBeat === 'hook' ? 'aspirational' : adBeat === 'cta' ? 'confident' : 'trustworthy');

            const transition = typeof scene?.transition === 'string' && scene.transition.trim().length > 0
              ? scene.transition.trim()
              : (idx === 0 ? 'cold open to establish context' : 'smooth continuity cut from previous scene');

            const durationNum = Number(scene?.duration);
            const duration = Number.isFinite(durationNum)
              ? Math.min(10, Math.max(4, Math.round(durationNum)))
              : 10;

            const basePrompt = typeof scene?.prompt === 'string' ? scene.prompt.trim() : '';
            const dialogue = typeof scene?.dialogue === 'string' ? scene.dialogue.trim() : '';
            const onScreenText = typeof scene?.onScreenText === 'string' ? scene.onScreenText.trim() : '';
            const aspectRatio = typeof scene?.aspectRatio === 'string' && scene.aspectRatio.trim().length > 0
              ? scene.aspectRatio.trim()
              : '16:9';

            const details: string[] = [];
            if (dialogue) details.push(`Spoken line cue: ${dialogue}`);
            if (onScreenText) details.push(`On-screen text cue: ${onScreenText}`);

            const qualityTail = 'Professional education advertisement style, premium cinematography, smooth camera movement, realistic people, clear framing, no third-party logos or trademarks.';
            const prompt = `${basePrompt}${basePrompt.endsWith('.') ? '' : '.'} ${details.join(' ')} ${qualityTail}`.trim();

            return {
              sceneName,
              adBeat,
              prompt,
              duration,
              aspectRatio,
              mood,
              transition,
              dialogue,
              onScreenText,
            };
          })
          .filter((scene: any) => scene.prompt && scene.prompt.length > 0);

        console.log(`[video] Generated ${visualPrompts.length} normalized visual prompts`);

        // Build structured output with visual prompts ready for Veo generation
        const payload = JSON.stringify({
          visualPrompts,
          projectName: videoData.projectName || 'Campaign Video',
          concept: videoData.concept || 'Education ad with aspiration, trust, and clear CTA',
          targetAudience: videoData.targetAudience || 'Students and parents considering overseas education',
          keyMessage: videoData.keyMessage || 'Expert counselling turns study abroad goals into admissions outcomes',
          meta: {
            type: 'video_concepts',
            count: visualPrompts.length,
            scenes: visualPrompts.map((p: any) => ({
              sceneName: p.sceneName,
              adBeat: p.adBeat,
              mood: p.mood,
              duration: p.duration || 10,
              transition: p.transition,
              hasDialogue: !!p.dialogue,
              hasOnScreenText: !!p.onScreenText,
            })),
          }
        });

        console.log('[execute-node] Video concept generation complete');
        response = NextResponse.json({ success: true, output: payload, nodeId });
        return response;
      } catch (err) {
        error = err as Error;
        console.error('[video] Video concept generation failed:', error);
        response = NextResponse.json({
          success: false,
          error: `Video concept generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }, { status: 500 });
        return response;
      }
    }

    // If image node, enforce ad creative style with CTA overlays
    if (context.nodeType === 'image') {
      finalPrompt += `\n\nAD CREATIVE REQUIREMENTS:\n- Generate EXACTLY 4 professional social media marketing images for an education consultancy.\n- ALL images must share a CONSISTENT brand identity: same color palette (navy, gold, white), same professional tone, same modern clean aesthetic.\n- Each image should be a SINGLE cohesive scene — NOT a collage, NOT a grid, NOT multiple panels stitched together.\n- Vary the CONTENT (different subjects: campus, students, graduation, travel) but keep the STYLE unified and professional.\n- Subject matter: students on campus, graduation moments, study abroad lifestyle, university buildings, counselling sessions, diverse student groups.\n- Each image should look like a polished Instagram/LinkedIn ad creative for a premium study abroad consultancy.\n- Integrate concise overlay text: headline (max 6 words) + subline (max 10 words).\n- Include a clear call-to-action phrase: "Book Free Counselling", "Start Your Journey", "Apply Now", "Check Eligibility".\n- Use clean readable typography, high contrast, and leave safe margins around text.\n- Return only raw images (no descriptive paragraphs).`;
    }

    if (context.nodeType === 'image') {
      // Enhanced image generation using structured variant specs
      try {
        console.log('[execute-node] Starting image generation for node:', nodeId);
        const baseImagePrompt = finalPrompt + `\n\nGLOBAL IMAGE QUALITY REQUIREMENTS:\n- Photorealistic fidelity, professional social media marketing style\n- Each image is a SINGLE unified scene — absolutely NO collages, NO grids, NO split panels, NO multi-image layouts\n- All 4 images must feel like part of the SAME campaign — consistent brand colors (navy, gold, white), consistent professional tone\n- Crisp edges, no artifacts, no mangled text\n- Provide clean negative space for overlay text (headline + subline + CTA)\n- Different subjects/content per image but SAME visual brand identity\n- Focus on education, campus life, diversity, and aspiration\n- Style reference: Premium Instagram ad carousel for a top education brand.`;
        
        console.log('[execute-node] Calling generateCampaignImages...');
        const generated = await generateCampaignImages(baseImagePrompt);
        console.log('[execute-node] Generated images count:', generated.length);
        
        if (generated.length === 0) {
          response = NextResponse.json({ success: true, output: 'No images returned by model.', nodeId });
          return response;
        }
        
        const images: { file: string; url: string; theme?: string; aspect?: string; mood?: string; publicId?: string }[] = [];
        for (let i = 0; i < generated.length; i++) {
          const g = generated[i];
          console.log(`[execute-node] Processing image ${i + 1}/${generated.length}:`, {
            mimeType: g.mimeType,
            dataLength: g.data?.length || 0,
            theme: g.meta.theme,
          });
          
          const ext = g.mimeType.includes('jpeg') ? 'jpg' : g.mimeType.split('/')[1] || 'png';
          
          // Upload to Cloudinary (async)
          console.log(`[execute-node] Uploading image ${i + 1} to Cloudinary...`);
          const saved = await saveBase64Image(g.data, 'campaign', ext);
          console.log(`[execute-node] Image ${i + 1} uploaded:`, {
            publicId: saved.publicId,
            url: saved.cloudinaryUrl,
          });
          
          images.push({
            file: saved.publicId || saved.filename,
            url: saved.cloudinaryUrl || saved.fullPath,
            theme: g.meta.theme,
            aspect: g.meta.aspect,
            mood: g.meta.mood,
            publicId: saved.publicId,
          });
        }
        
        const payload = JSON.stringify({
          images,
          meta: {
            type: 'ad_creatives',
            count: images.length,
            variants: images.map(i => ({ theme: i.theme, aspect: i.aspect, mood: i.mood })),
            guidance: 'Each variant intentionally differs in composition, color, lighting, and mood.',
            ctaExamples: ['Book Free Counselling', 'Start Your Journey', 'Apply Now', 'Check Eligibility'],
            storage: 'cloudinary'
          }
        });
        
        console.log('[execute-node] Image generation complete, returning payload');
        response = NextResponse.json({ success: true, output: payload, nodeId });
        return response;
      } catch (e) {
        error = e as Error;
        console.error('[execute-node] Image generation failed:', {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
          nodeId,
        });
        response = NextResponse.json({ 
          success: false, 
          error: `Image generation failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
          details: e instanceof Error ? e.stack : undefined
        }, { status: 500 });
        return response;
      }
    } else {
      // Text generation (ad copy, research, etc.) using Gemini 2.5 Pro
      const textModel = getFlashModel();
      try {
        const output = await generateWithRetry(textModel, finalPrompt);
        const processedOutput = output.trim();
        response = NextResponse.json({ success: true, output: processedOutput, nodeId });
        return response;
      } catch (err) {
        error = err as Error;
        console.error('Text generation failed:', error);
        response = NextResponse.json({ success: false, error: 'Failed to generate content' }, { status: 500 });
        return response;
      }
    }

  } catch (err) {
    error = err as Error;
    console.error('Error executing node:', error);
    response = NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute node',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
    return response;
  } finally {
    const statusCode = response?.status || (error ? 500 : 200);
    const finalSummary = {
      ...executionSummary,
      nodeType: requestPayload?.nodes?.find?.((n: any) => n.id === requestPayload?.nodeId)?.data?.type || null,
      statusCode,
      success: !error && statusCode < 400,
      durationMs: Date.now() - startTime,
      errorMessage: error?.message || null,
    };

    appendObservabilityLog('unified-executor', {
      event: 'node_execution_finished',
      ...finalSummary,
    });

    appendObservabilityLog('agents', {
      event: 'agent_output_summary',
      ...finalSummary,
    });

    if (error || statusCode >= 400) {
      appendObservabilityLog('errors', {
        event: 'agent_execution_error',
        ...finalSummary,
      });
    }

    // Log audit event (non-blocking)
    logAuditEvent({
      request,
      response: response || undefined,
      session,
      error,
      action: 'execute_workflow_node',
      metadata: finalSummary,
      startTime,
    }).catch(() => {});
  }
}
