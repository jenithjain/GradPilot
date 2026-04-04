import { NextResponse } from 'next/server';
import { getReasoningModel, generateWithRetry, parseJSONFromResponse } from '@/lib/gemini';
import { nanoid } from 'nanoid';

export async function POST(request: Request) {
  try {
    const { rationale, brief } = await request.json();

    if (!rationale || typeof rationale !== 'string') {
      return NextResponse.json(
        { error: 'Strategy rationale is required' },
        { status: 400 }
      );
    }

    const model = getReasoningModel();

    const systemPrompt = `You are an AI Workflow Architect and Education Campaign Manager specialized in converting student outreach strategies into executable workflow graphs for Fateh Education, a leading overseas education consultancy.

Your task is to convert the provided campaign strategy into a React Flow compatible graph structure with intelligent, semantic edges.

CRITICAL REQUIREMENTS:

1. OUTPUT FORMAT: Respond with ONLY a valid JSON object. No markdown, no code blocks, no explanations.

2. STRUCTURE: The JSON must have two arrays:
   {
     "nodes": [...],
     "edges": [...]
   }

3. NODE STRUCTURE: Each node must be:
   {
     "id": "unique-string-id",
     "type": "agentNode",
     "position": { "x": number, "y": number },
     "data": {
       "label": "Agent Name",
       "type": "strategy" | "copy" | "image" | "video" | "research" | "exa_research" | "timeline" | "distribution" | "email" | "linkedin" | "twitter",
       "status": "idle",
       "content": null,
       "promptContext": "Detailed instruction for this specific agent task"
     }
   }

4. EDGE STRUCTURE: Each edge must have semantic meaning:
   {
     "id": "unique-edge-id",
     "source": "source-node-id",
     "target": "target-node-id",
     "type": "smartEdge",
     "label": "Context Type (e.g., 'Student Persona', 'Visual Direction')",
     "animated": true,
     "data": {
       "label": "Human-readable connection name",
       "transferLogic": "Detailed instruction on WHAT data flows from source to target and HOW it should be used. Be specific about which aspects of the source output should influence the target."
     }
   }

5. LAYOUT: Position nodes in a clear top-to-bottom or left-to-right flow:
   - Start node at (0, 0)
   - Use x increments of 350 for horizontal spacing
   - Use y increments of 200 for vertical spacing
   - Create a tree-like structure that branches and merges logically

6. AGENT TYPES TO INCLUDE (select 4-8 relevant ones):
   - "strategy": Student Segment Analyzer (research target student demographics, lead qualification criteria, intake timing)
   - "copy": Outreach Copy Generator (multi-platform content: headlines, primary texts, CTAs for student recruitment)
   - "image": Visual Asset Generator (create education-themed image prompts: campus life, graduation, diversity, study abroad lifestyle)
   - "video": Cinematic Video Agent (generate cinematic video concepts and visual prompts for short video clips showcasing campus life, student testimonials, study abroad atmosphere using Google Veo AI — each scene is 4-8 seconds)
   - "research": Education Market Researcher (find trending courses, university rankings, scholarship opportunities, competitor analysis)
   - "exa_research": Web Research Agent (POWERFUL — uses neural search to crawl the live web for student leads, market intelligence, competitor research, student communities, and generates a structured CSV-ready lead list with relevance scores. ALWAYS include this node when the campaign involves lead generation, market research, or competitor analysis. This agent searches the REAL web and returns exportable data.)
   - "timeline": Campaign Timeline Optimizer (align with university intake cycles — UK/Ireland Sep and Jan intakes, IELTS exam dates)
   - "distribution": Student Outreach Scheduler (plan channel strategy: Instagram, YouTube, WhatsApp, webinars, campus events, education fairs)
   - "email": Student Email Campaign (generate and send personalized outreach emails to student CSV contact lists)
   - "linkedin": LinkedIn Post Publisher (generate and post professional content about study abroad success stories, counselling tips)
   - "twitter": Twitter Post Publisher (generate and post tweets about study abroad tips, deadlines, scholarships)

7. EDGE SEMANTICS: For each connection, clearly define:
   - WHAT information passes between nodes
   - HOW that information should influence the target node
   - Example: "Extract the target student segment (education level, preferred countries, test readiness, budget) from the Student Segment Analyzer output. Use these insights to tailor the tone, language, urgency, and specific university/course recommendations in the generated copy."

SPECIAL INSTRUCTIONS PER NODE TYPE:
- For type "copy": set data.promptContext to request platform-ready student outreach content (3 headlines, 3 primary texts, CTAs like "Book Free Counselling", "Check Your Eligibility") tailored to the student segment and campaign strategy.
- For type "image": set data.promptContext to request 2-4 education-themed visuals with clear art direction; subjects like diverse student groups, campus life, graduation, travel/exploration, counselling sessions.
- For type "video": set data.promptContext to request 2-4 education-ad video scene concepts with person-led storytelling (student/counsellor/parent), spoken dialogue cues, and optional on-screen CTA text. Each scene should include camera movement, transition continuity, lighting, and mood. Prefer 10-second scenes when possible (or model-safe maximum). Topics: counselling sessions, campus tours, student life, graduation outcomes, scholarship/visa confidence moments. These prompts will be used to generate polished short ad clips with Google Veo AI.
- For type "exa_research": set data.promptContext to describe WHAT to search for on the web — e.g. "Search for prospective Indian students interested in UK universities, find student communities, competitor consultancies, trending courses, and generate a lead list with contact sources." This node uses neural web search to crawl the real web and produce structured market intelligence + exportable CSV lead lists. Place it early in the workflow (before strategy/copy nodes) so its output feeds into downstream content generation.
- For type "email": set data.promptContext to generate professional student outreach emails with compelling subject lines, HTML content, and personalization. Tone should be encouraging and mentor-like. The user will upload a CSV file with recipient emails. This node will automatically send bulk emails to all recipients.
- For type "linkedin": set data.promptContext to generate engaging LinkedIn posts about study abroad guidance, student success stories, university spotlights, or career transformation through overseas education. This node will automatically post to the user's connected LinkedIn account.
- For type "twitter": set data.promptContext to generate concise, motivational tweets (max 280 chars) about study abroad tips, deadlines, scholarships, with relevant hashtags. This node will automatically post to the user's connected Twitter account.

IMPORTANT: Consider including email nodes for direct student outreach campaigns, or social media nodes (linkedin/twitter) for social posting capabilities.

CAMPAIGN CONTEXT:
Brief: ${brief}

Strategy: ${rationale}

Generate a comprehensive workflow graph with as many specialized agent nodes as needed (typically 5-8 nodes) to create a complete student outreach campaign. Connect them with semantic edges. Ensure the workflow represents a logical campaign execution pipeline that covers: web research (exa_research) → student research → strategy → creative production (image + video) → social media posting/email outreach → distribution → lead nurturing. ALWAYS include an exa_research node as one of the first nodes for web-based lead generation and market intelligence. Include email nodes when the campaign involves direct outreach to students or sending scholarship/admission updates. Include a video node when the campaign would benefit from cinematic visual content (campus tours, student testimonials, study abroad lifestyle clips).

Respond with ONLY the JSON object:`;

    const responseText = await generateWithRetry(model, systemPrompt);
    const parsedResponse = parseJSONFromResponse(responseText);

    // Validate the response structure
    if (!parsedResponse.nodes || !Array.isArray(parsedResponse.nodes)) {
      throw new Error('Invalid nodes array in response');
    }

    if (!parsedResponse.edges || !Array.isArray(parsedResponse.edges)) {
      throw new Error('Invalid edges array in response');
    }

    // Ensure all nodes have required fields
    const validatedNodes = parsedResponse.nodes.map((node: any) => ({
      id: node.id || nanoid(),
      type: 'agentNode',
      position: node.position || { x: 0, y: 0 },
      data: {
        label: node.data?.label || 'Untitled Agent',
        type: node.data?.type || 'strategy',
        status: 'idle',
        content: null,
        promptContext: node.data?.promptContext || '',
        output: undefined,
        error: undefined,
      },
    }));

    // Ensure all edges have required fields and semantic data
    const validatedEdges = parsedResponse.edges.map((edge: any) => ({
      id: edge.id || nanoid(),
      source: edge.source,
      target: edge.target,
      type: 'smartEdge',
      label: edge.label || '',
      animated: true,
      data: {
        label: edge.data?.label || edge.label || 'Context',
        transferLogic: edge.data?.transferLogic || 'Use the source node\'s output as contextual guidance for the target generation.',
      },
    }));

    return NextResponse.json({
      nodes: validatedNodes,
      edges: validatedEdges,
    });

  } catch (error) {
    console.error('Error generating workflow:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate campaign workflow',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
