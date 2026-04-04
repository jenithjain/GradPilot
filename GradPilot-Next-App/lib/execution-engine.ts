import { WorkflowNode, WorkflowEdge, NodeExecutionContext } from '@/types/workflow';

/**
 * Builds the execution context for a node by analyzing incoming edges
 * and compiling context from source nodes
 */
export function buildExecutionContext(
  targetNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  campaignBrief: string,
  campaignStrategy: string,
  kyc?: Record<string, any>
): NodeExecutionContext {
  // Find the target node
  const targetNode = nodes.find(n => n.id === targetNodeId);
  if (!targetNode) {
    throw new Error(`Node with ID ${targetNodeId} not found`);
  }

  // Find all incoming edges to this node
  const incomingEdges = edges.filter(edge => edge.target === targetNodeId);

  // Build context from each incoming edge
  const incomingContext = incomingEdges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    
    if (!sourceNode) {
      console.warn(`Source node ${edge.source} not found for edge ${edge.id}`);
      return null;
    }

    // Only include context if the source node has completed
    if (sourceNode.data.status !== 'complete' || !sourceNode.data.output) {
      return null;
    }

    return {
      sourceNodeId: sourceNode.id,
      sourceOutput: sourceNode.data.output,
      transferLogic: edge.data?.transferLogic || 'Use the output from the previous step',
      edgeLabel: edge.data?.label || edge.label || 'Context',
    };
  }).filter(Boolean) as NodeExecutionContext['incomingEdges'];

  return {
    nodeId: targetNode.id,
    nodeType: targetNode.data.type,
    promptContext: targetNode.data.promptContext,
    incomingEdges: incomingContext,
    campaignContext: {
      brief: campaignBrief,
      strategy: campaignStrategy,
      kyc,
    },
  };
}

/**
 * Compiles the final prompt by combining the node's base prompt
 * with context from incoming edges
 */
export function compilePrompt(context: NodeExecutionContext): string {
  const { nodeType, promptContext, incomingEdges, campaignContext } = context;

  // Start with campaign context
  let prompt = `CAMPAIGN CONTEXT:\n`;
  prompt += `Brief: ${campaignContext.brief}\n\n`;
  prompt += `Strategy Overview: ${campaignContext.strategy}\n\n`;

  // Include KYC student profile if available
  if (campaignContext.kyc) {
    try {
      const entries: string[] = [];
      Object.entries(campaignContext.kyc).forEach(([key, value]) => {
        if (value === null || typeof value === 'undefined') return;
        const prettyKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        if (Array.isArray(value)) {
          if (value.length) entries.push(`${prettyKey}: ${value.join(', ')}`);
        } else {
          entries.push(`${prettyKey}: ${String(value)}`);
        }
      });
      if (entries.length) {
        prompt += `STUDENT PROFILE (KYC):\n`;
        entries.forEach(line => { prompt += `- ${line}\n`; });
        prompt += `\nUse the student profile attributes above to tailor outputs (tone, channels, personas, timing, and constraints).\n\n`;
      }
    } catch {}
  }

  // Add context from incoming edges
  if (incomingEdges.length > 0) {
    prompt += `CONTEXT FROM PREVIOUS STEPS:\n`;
    
    incomingEdges.forEach((edge, index) => {
      prompt += `\n--- ${edge.edgeLabel} ---\n`;
      prompt += `Transfer Logic: ${edge.transferLogic}\n`;
      prompt += `Source Output:\n${edge.sourceOutput}\n`;
    });
    
    prompt += `\n`;
  }

  // Add the specific task for this node
  prompt += `YOUR TASK:\n`;
  prompt += `${promptContext}\n\n`;

  // Add type-specific instructions
  switch (nodeType) {
    case 'copy':
      prompt += `You are an Education Counselling Ad Copy generator for Fateh Education, a leading overseas education consultancy specializing in UK and Ireland university placements.
Create platform-ready ads targeting prospective students and parents interested in studying abroad.
KEEP IT CONCISE. Return:
- 2 headlines (30-40 chars each) — e.g. "Your UK Dream Starts Here", "Study Abroad with Expert Guidance"
- 2 primary texts (80-120 chars) — focusing on benefits like 45,000+ placements, 120+ partner universities, IELTS/PTE training, scholarship assistance
- 2 CTAs — e.g. "Book Free Counselling", "Check Your Eligibility"
Output as a clean list. NO long explanations.\n`;
      break;
    
    case 'image':
      prompt += `Generate 4 professional social media marketing images for Fateh Education's student outreach campaigns. CRITICAL: Each image must be a SINGLE cohesive scene — NOT a collage, NOT a grid, NOT multiple panels. All images should share a consistent brand aesthetic (navy, gold, white palette) while varying the subject: students on campus, graduation moments, study abroad lifestyle, university buildings. Style: polished Instagram/LinkedIn ad creative. If this model supports direct image output, return images. Otherwise, return detailed prompts.\n`;
      break;
    
    case 'research':
      prompt += `Conduct research on student outreach and overseas education counselling trends. Provide CONCISE, actionable insights relevant to Fateh Education's UK/Ireland focus.
Consider: student demographics, admission cycle timing, IELTS/PTE preparation trends, popular courses, scholarship availability, visa process updates, competitor strategies.
LIMIT: 5-7 bullet points maximum. Be specific but brief. NO long paragraphs.\n`;
      break;
    
    case 'exa_research':
      prompt += `You are an AI Lead Research Agent with real-time web search capabilities. Your task is to analyze web research data and produce a comprehensive lead generation and market intelligence report.

The web search tool has already crawled the live internet and gathered real results. Your job is to:

1. **Raw Search Results**: List EVERY search result with title, URL, and 1-2 line summary — do NOT skip any results
2. **Lead Generation**: Extract specific student leads, education consultancies, student communities, university programs, and individual contacts from the results
3. **Market Analysis**: Analyze the education market landscape — trending courses, popular destinations, competitor strategies, student preferences
4. **Student Needs Assessment**: Understand what prospective students want — course types, budget concerns, visa worries, scholarship needs
5. **CSV Lead Data**: Generate a structured CSV data block that can be exported

Format your output EXACTLY as:
## 🔍 Web Research Report
### 🛠️ Search Tool: Neural Web Search

### 📡 Raw Search Results
[List EVERY result: numbered, with **Title**, URL, and brief summary]

### 📊 Market Intelligence
[Market analysis insights with specific data from results]

### 🎯 Lead Prospects
| Name | Type | Source | Score | Notes |
|------|------|--------|-------|-------|
[Lead table rows — be SPECIFIC, use real names/orgs from results]

### 📥 Exportable Lead Data
\`\`\`csv
Name,Type,Source URL,Relevance Score,Contact Info,Notes
[CSV rows matching the table above]
\`\`\`

### 📋 Student Needs Analysis
[What students are looking for based on the search data]

### 💡 Key Takeaways
[5-7 actionable bullet points for the campaign]

Be thorough, data-driven, and reference specific URLs. Extract REAL names, organizations, and contacts from search results.\n`;
      break;
    
    case 'strategy':
      prompt += `Provide strategic analysis and recommendations for student recruitment and counselling campaigns for Fateh Education.
Consider: target student segments (undergrad/postgrad, regions, fields of study), intake timing (Jan/Sep), lead qualification (Hot/Warm/Cold scoring), counsellor productivity optimization, and channel strategy (webinars, social media, campus visits, WhatsApp).
LIMIT: 3-5 key points maximum. Use clear headings and brief bullet points. NO lengthy explanations.\n`;
      break;
    
    case 'timeline':
      prompt += `Create a concise campaign timeline for a student outreach or counselling campaign aligned with university intake cycles (UK/Ireland September and January intakes).
Include key milestones: awareness phase, lead generation, counselling sessions, application deadlines, visa processing windows, pre-departure orientation.
LIMIT: 5-7 key milestones maximum. Be specific with dates and actions. Keep descriptions under 15 words each.\n`;
      break;
    
    case 'distribution':
      prompt += `Provide a distribution strategy for reaching prospective students interested in studying abroad (UK/Ireland focus).
LIMIT: 4-6 channels maximum. Consider: Instagram/YouTube for awareness, WhatsApp for nurturing, webinars for engagement, email for follow-ups, campus ambassador programs, education fairs.
For each: channel name, timing (1 line), key tactics (2-3 bullet points). Keep it actionable and brief.\n`;
      break;
    
    case 'linkedin':
      prompt += `You are a LinkedIn content creator for Fateh Education, a leading overseas education consultancy. Generate ONE professional LinkedIn post.\n
REQUIREMENTS:
- Maximum 2800 characters (strict limit - LinkedIn allows 3000 but leave buffer)
- Professional, informative, and inspiring tone aimed at students and parents
- Topics: study abroad success stories, university spotlight, scholarship tips, visa guidance, IELTS prep advice, student testimonials, placement milestones
- Include relevant hashtags (3-5) — e.g. #StudyAbroad #UKUniversities #IrelandEducation #IELTS #FatehEducation
- Use line breaks for readability
- Focus on value: actionable tips, success metrics, or inspiring stories
- NO multiple post variations - just ONE post ready to publish

Output ONLY the post text, nothing else.\n`;
      break;
    
    case 'twitter':
      prompt += `You are a Twitter/X content creator for Fateh Education, a study abroad consultancy. Generate ONE tweet.\n
REQUIREMENTS:
- Maximum 270 characters (strict limit - Twitter allows 280 but leave buffer)
- Engaging, motivational, student-focused
- Topics: study abroad tips, application deadlines, IELTS scores, scholarship alerts, placement stats
- Include 1-2 relevant hashtags — e.g. #StudyInUK #StudyAbroad
- Can use emojis sparingly (🎓📚✈️🌍)
- NO multiple tweet variations - just ONE tweet ready to publish

Output ONLY the tweet text, nothing else.\n`;
      break;
    
    case 'email':
      prompt += `You are an expert education marketing copywriter for Fateh Education, a leading overseas education consultancy with 45,000+ successful placements. Your task is to write a STUDENT-FACING outreach email based on the campaign context above.

⚠️ CRITICAL INSTRUCTION ⚠️
The campaign brief and strategy above are YOUR INSTRUCTIONS - they describe what to write about.
DO NOT copy the brief text into the email. DO NOT quote the brief.
INSTEAD: Transform those instructions into persuasive, empathetic outreach copy that speaks directly to students and parents.

Think of it this way:
- Campaign Brief = Your assignment (what to create)
- Email Content = What you deliver to students (the actual outreach message)

EXAMPLE:
❌ WRONG: "Create a campaign to recruit students for UK universities..."
✅ RIGHT: "Your dream of studying at a top UK university is closer than you think..."

⚠️ PERSONALIZATION PLACEHOLDERS ⚠️
- Use ONLY {{name}} for recipient name personalization
- DO NOT use {{FirstName}}, {{CompanyName}}, {{LastName}}, or any other placeholders
- DO NOT use bracketed placeholders like [Your Company Name], [University Name], [Link Here]
- All other content must be COMPLETE and STATIC - no placeholders anywhere
- Refer to the consultancy as "Fateh Education" or "our team"
- CTA links can use '#' as href - they will be updated by the system

REQUIRED JSON OUTPUT (use ONLY this exact structure):
{
  "subject": "Compelling subject line here",
  "html": "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'><h1 style='color: #333333; font-size: 24px; margin-bottom: 20px;'>Hello {{name}},</h1><p style='color: #666666; font-size: 16px; line-height: 1.6; margin-bottom: 15px;'>First paragraph - hook the reader...</p><p style='color: #666666; font-size: 16px; line-height: 1.6; margin-bottom: 15px;'>Second paragraph - present solution and benefits...</p><div style='margin: 30px 0; text-align: center;'><a href='#' style='background-color: #0066cc; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;'>Book Free Counselling</a></div><p style='color: #666666; font-size: 14px; margin-top: 30px;'>Best regards,<br>Team Fateh Education</p></div>",
  "text": "Hello {{name}},\\n\\nFirst paragraph...\\n\\nSecond paragraph...\\n\\nBook Free Counselling: [link]\\n\\nBest regards,\\nTeam Fateh Education"
}

EMAIL WRITING RULES:
1. Subject Line (40-60 chars): Focus on the BENEFIT or OPPORTUNITY, not the campaign description
   ✅ "Your UK University Journey Starts Here"
   ❌ "Our Student Recruitment Campaign Information"

2. Opening Hook (1 paragraph): Start with a relatable aspiration or concern
   - Address the student's dream of studying abroad or common worries (cost, eligibility, IELTS)
   - Make it personal and relevant to their academic stage
   - Example: "Dreaming of studying at a world-class university in the UK? You're not alone — and we're here to make it happen."

3. Solution & Benefits (1-2 paragraphs):
   - Present Fateh Education's services as the answer
   - Highlight 2-3 key benefits (45,000+ placements, 120+ partner universities, scholarship guidance, visa support)
   - Use concrete details, not abstract descriptions
   - Focus on what THEY gain: career prospects, global exposure, expert guidance
   - All details must be COMPLETE - no bracketed placeholders

4. Call-to-Action:
   - Clear, action-oriented button text
   - Examples: "Book Free Counselling", "Check Your Eligibility", "Start Your Application", "Get Scholarship Info", "Talk to a Counsellor"
   - NOT generic: "Learn More", "Click Here"
   - Use action words related to the student's journey

5. Closing Signature:
   - Use "Best regards," or "Warm regards,"
   - Follow with "Team Fateh Education" or "Your Counselling Team at Fateh Education"
   - DO NOT use placeholders like [Your Company Name] or [Team Name]

6. Tone & Voice:
   - Write as if speaking directly to ONE student
   - Use "you" and "your" language
   - Be warm, encouraging, and professional — like a supportive mentor
   - Avoid being salesy; focus on empowerment and opportunity

7. HTML Format Requirements:
   - Use single quotes (') for all HTML attributes
   - No escaped characters
   - Include {{name}} placeholder ONLY for recipient name personalization
   - Mobile-responsive (max-width: 600px)

8. Plain Text Version:
   - Mirror HTML content without tags
   - Use \\n for line breaks (double backslash in JSON)
   - Keep it readable and well-structured
   - Replace button with "Action: [link]" format

NOW: Create the student-facing email with NO PLACEHOLDERS except {{name}}. Every sentence must be complete and ready to send.\n`;
      break;
  }

  return prompt;
}

/**
 * Validates that all dependencies for a node are complete
 */
export function canExecuteNode(
  nodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): { canExecute: boolean; reason?: string } {
  const node = nodes.find(n => n.id === nodeId);
  
  if (!node) {
    return { canExecute: false, reason: 'Node not found' };
  }

  if (node.data.status === 'loading') {
    return { canExecute: false, reason: 'Node is already executing' };
  }

  if (node.data.status === 'complete') {
    return { canExecute: true }; // Allow re-execution
  }

  // Find all incoming edges
  const incomingEdges = edges.filter(edge => edge.target === nodeId);

  // Check if all source nodes are complete
  for (const edge of incomingEdges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    
    if (!sourceNode) {
      continue; // Skip if source node not found
    }

    if (sourceNode.data.status !== 'complete') {
      return { 
        canExecute: false, 
        reason: `Waiting for "${sourceNode.data.label}" to complete` 
      };
    }
  }

  return { canExecute: true };
}

/**
 * Gets the execution order for all nodes (topological sort)
 */
export function getExecutionOrder(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      throw new Error('Circular dependency detected in workflow');
    }

    visiting.add(nodeId);

    // Visit all dependencies first
    const incomingEdges = edges.filter(edge => edge.target === nodeId);
    for (const edge of incomingEdges) {
      visit(edge.source);
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId);
  }

  // Visit all nodes
  for (const node of nodes) {
    visit(node.id);
  }

  return order;
}
