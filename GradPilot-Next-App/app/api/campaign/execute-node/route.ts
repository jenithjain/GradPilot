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

export async function POST(request: Request) {
  const startTime = Date.now();
  let session: any = null;
  let response: Response | null = null;
  let error: Error | null = null;

  try {
    session = await getServerSession(authOptions as any);
    const { nodeId, nodes, edges, brief, strategy } = await request.json();

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

    // Compile the final prompt
    let finalPrompt = compilePrompt(context);

    // Exa.ai Web Research node - searches web then analyzes with Gemini
    if (context.nodeType === 'exa_research') {
      try {
        // Step 1: Build search queries from campaign context using Gemini
        const queryModel = getFlashModel();
        const queryPrompt = `Based on the following campaign context, generate 4-5 specific web search queries to find INDIVIDUAL student leads, student communities, education consultancies, and market intelligence.

Focus on finding:
- Individual students looking to study abroad (forums, LinkedIn posts, Reddit threads, student blogs)
- Student communities and groups (Facebook groups, WhatsApp communities, Discord servers)
- Education fair attendees and registrants
- Competitor consultancy websites and their student testimonials
- University admission pages with intake information

Campaign Brief: ${brief}
Strategy: ${strategy}

Return ONLY a JSON array of search query strings. Make queries specific with names, locations, platforms. Example: ["Indian students looking for UK university admission 2025 Reddit", "study abroad consultancy reviews students India"]`;

        const queryResponse = await generateWithRetry(queryModel, queryPrompt);
        let searchQueries: string[];
        try {
          const cleaned = queryResponse.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '');
          searchQueries = JSON.parse(cleaned);
          if (!Array.isArray(searchQueries)) throw new Error('Not an array');
        } catch {
          // Fallback queries based on brief
          searchQueries = [
            `${brief.substring(0, 80)} student leads education`,
            'students looking to study abroad UK Ireland 2025 forums',
            'overseas education consultancy student testimonials reviews',
            'study abroad student community groups India UK',
          ];
        }

        console.log('[exa_research] Search queries:', searchQueries);

        // Step 2: Call Exa.ai for each query category
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        
        // People search for student leads
        const peopleRes = await fetch(`${baseUrl}/api/campaign/exa-research`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queries: searchQueries.slice(0, 2), category: 'people', numResults: 10 }),
        });
        const peopleData = await peopleRes.json();

        // Company search for institutions/competitors
        const companyRes = await fetch(`${baseUrl}/api/campaign/exa-research`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queries: searchQueries.slice(0, 2), category: 'company', numResults: 10 }),
        });
        const companyData = await companyRes.json();

        // News/general search for market intelligence
        const newsRes = await fetch(`${baseUrl}/api/campaign/exa-research`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queries: searchQueries, numResults: 10 }),
        });
        const newsData = await newsRes.json();

        // Step 3: Compile all Exa results
        const allResults = [
          ...(peopleData.results || []),
          ...(companyData.results || []),
          ...(newsData.results || []),
        ];

        const allTraces = [
          ...(peopleData.toolTrace || []),
          ...(companyData.toolTrace || []),
          ...(newsData.toolTrace || []),
        ];

        console.log(`[exa_research] Total Exa results: ${allResults.length}`);

        // Step 4: Build enriched prompt with Exa data
        const exaContext = allResults.map((r: any, i: number) => {
          const highlights = (r.highlights || []).join(' ').substring(0, 500);
          return `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.author ? `Author: ${r.author}\n    ` : ''}${r.publishedDate ? `Date: ${r.publishedDate}\n    ` : ''}Summary: ${highlights}`;
        }).join('\n\n');

        const enrichedPrompt = finalPrompt + `\n\n--- REAL-TIME WEB SEARCH RESULTS ---\nTool: Neural Web Search API\nQueries Used: ${searchQueries.join(' | ')}\nTotal Results Found: ${allResults.length}\n\n${exaContext}\n\n--- END OF SEARCH RESULTS ---\n\nIMPORTANT INSTRUCTIONS:\n1. Analyze ALL the above search results thoroughly\n2. In your output, include a "Raw Search Results" section that lists EVERY result with its title, URL, and a 1-2 line summary\n3. Generate a CSV-formatted lead list inside a \`\`\`csv code block with columns: Name,Type,Source URL,Relevance Score,Contact Info,Notes\n4. Be specific — name real people, real organizations, real URLs from the results\n5. Reference specific data points and URLs throughout your analysis`;

        // Step 5: Generate analysis with Gemini
        const textModel = getFlashModel();
        const analysis = await generateWithRetry(textModel, enrichedPrompt);

        // Step 6: Prepend tool trace to output
        const toolTraceBlock = `### 🛠️ Web Search Tool Calls\n${allTraces.map(t => `\`${t}\``).join('\n')}\n\n---\n\n`;

        response = NextResponse.json({
          success: true,
          output: toolTraceBlock + analysis,
          nodeId,
        });
        return response;
      } catch (err: any) {
        console.error('[exa_research] Error:', err);
        response = NextResponse.json({
          success: true,
          output: `⚠️ Web research failed: ${err.message}. Falling back to general research.`,
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
        
        // Post to the social platform using app credentials
        const apiEndpoint = context.nodeType === 'linkedin' ? '/api/linkedin/post' : '/api/twitter/post';
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        
        console.log(`[${context.nodeType}] Attempting to post to ${baseUrl}${apiEndpoint}`);
        
        const postRes = await fetch(`${baseUrl}${apiEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: postText, imageUrls }),
        });
        
        const postData = await postRes.json();
        console.log(`[${context.nodeType}] Post response:`, postData);
        
        if (!postRes.ok || !postData.success) {
          response = NextResponse.json({ 
            success: true, 
            output: `Content generated:\n\n${postText}\n\n⚠️ Failed to post: ${postData.error || 'Unknown error'}. Details: ${JSON.stringify(postData.details || {})}`,
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
        // Generate the email content using AI
        console.log('[email] Generating email content with AI...');
        const generatedContent = await generateWithRetry(textModel, finalPrompt);
        
        console.log('[email] Raw AI response (first 500 chars):', generatedContent.substring(0, 500));
        
        // Parse JSON response with better error handling
        let emailData;
        try {
          // Remove markdown code blocks if present
          let cleanedContent = generatedContent.trim();
          
          // Remove ```json and ``` markers
          cleanedContent = cleanedContent.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
          
          // Try to extract JSON from the response
          const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            emailData = JSON.parse(jsonMatch[0]);
            console.log('[email] Successfully parsed JSON from AI response');
            console.log('[email] Parsed data:', {
              subject: emailData.subject?.substring(0, 50),
              htmlPreview: emailData.html?.substring(0, 100),
              textPreview: emailData.text?.substring(0, 100),
            });
          } else {
            throw new Error('No JSON object found in response');
          }
          
          // Validate and ensure required fields exist with content
          if (!emailData.subject || typeof emailData.subject !== 'string' || emailData.subject.trim().length === 0) {
            throw new Error('Missing or empty subject field');
          }
          
          if (!emailData.html || typeof emailData.html !== 'string' || emailData.html.trim().length === 0) {
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
          htmlLength: emailData.html?.length || 0,
          textLength: emailData.text?.length || 0,
          htmlPreview: emailData.html?.substring(0, 150),
        });

        // Get email list from node data (should be uploaded via UI)
        const node = (nodes as WorkflowNode[]).find(n => n.id === nodeId);
        const emailList = (node?.data as any)?.emailList;

        if (!emailList || !Array.isArray(emailList) || emailList.length === 0) {
          response = NextResponse.json({ 
            success: true, 
            output: `✉️ Email content generated:\n\nSubject: ${emailData.subject}\n\n⚠️ No email list uploaded. Please upload a CSV file with email addresses to send this campaign.\n\nPreview:\n${emailData.text?.substring(0, 200) || emailData.html?.substring(0, 200)}...`,
            nodeId,
            metadata: emailData,
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
          }),
        });

        const sendData = await sendRes.json();
        console.log('[email] Send result:', sendData);

        if (!sendRes.ok || !sendData.success) {
          response = NextResponse.json({ 
            success: true, 
            output: `Email content generated:\n\nSubject: ${emailData.subject}\n\n⚠️ Failed to send emails: ${sendData.error || 'Unknown error'}\n\nDetails: ${JSON.stringify(sendData.details || {})}`,
            nodeId,
            metadata: emailData,
          });
          return response;
        }

        const errorSummary = sendData.errors && sendData.errors.length > 0 
          ? `\n\n⚠️ Some emails failed (${sendData.failed}/${sendData.total}):\n${sendData.errors.slice(0, 3).join('\n')}`
          : '';

        response = NextResponse.json({ 
          success: true, 
          output: `✅ Email campaign sent successfully!\n\nSubject: ${emailData.subject}\n\n📧 Sent: ${sendData.sent}/${sendData.total} emails${errorSummary}\n\nRecipients: ${emailList.slice(0, 5).map((r: any) => typeof r === 'string' ? r : r.email).join(', ')}${emailList.length > 5 ? ` and ${emailList.length - 5} more...` : ''}`,
          nodeId,
          metadata: {
            ...emailData,
            sendStats: {
              sent: sendData.sent,
              failed: sendData.failed,
              total: sendData.total,
            },
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
    // Log audit event (non-blocking)
    logAuditEvent({
      request,
      response: response || undefined,
      session,
      error,
      action: 'execute_workflow_node',
      metadata: { nodeId: (request as any).nodeId },
      startTime,
    }).catch(() => {});
  }
}
