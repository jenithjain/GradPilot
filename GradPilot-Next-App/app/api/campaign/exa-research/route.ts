import { NextResponse } from 'next/server';
import Exa from 'exa-js';

const exa = new Exa(process.env.EXA_API_KEY);

interface ExaSearchParams {
  queries: string[];
  category?: 'people' | 'company' | 'news' | 'research paper';
  numResults?: number;
  includeText?: boolean; // Get full text content for better extraction
}

// Helper to extract emails from text
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  // Filter out common fake/example emails
  return [...new Set(matches)].filter(email => 
    !email.includes('example.com') && 
    !email.includes('test.com') &&
    !email.includes('domain.com') &&
    !email.includes('email.com') &&
    !email.includes('yourname@')
  );
}

// Helper to extract phone numbers from text
function extractPhones(text: string): string[] {
  // Match various phone formats including Indian numbers
  const phoneRegex = /(?:\+?91[-.\s]?)?(?:\d{10}|\d{5}[-.\s]?\d{5}|\(\d{3}\)[-.\s]?\d{3}[-.\s]?\d{4}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/g;
  const matches = text.match(phoneRegex) || [];
  return [...new Set(matches)].filter(phone => phone.replace(/\D/g, '').length >= 10);
}

// Helper to extract names from LinkedIn URLs or author fields
function extractNameFromUrl(url: string): string | null {
  // LinkedIn profile URL pattern
  const linkedinMatch = url.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/);
  if (linkedinMatch) {
    return linkedinMatch[1]
      .split('-')
      .filter(part => isNaN(Number(part))) // Remove numbers like IDs
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
      .trim();
  }
  return null;
}

// Helper to extract social handles
function extractSocialHandles(text: string, url: string): { linkedin?: string; twitter?: string; whatsapp?: string[] } {
  const handles: { linkedin?: string; twitter?: string; whatsapp?: string[] } = {};
  
  // LinkedIn - check URL first, then text content
  const linkedinMatch = url.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/) || 
                        text.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/);
  if (linkedinMatch) handles.linkedin = linkedinMatch[1];
  
  // Twitter/X
  const twitterMatch = text.match(/@([a-zA-Z0-9_]{1,15})/) ||
                       url.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/);
  if (twitterMatch) handles.twitter = twitterMatch[1];

  // WhatsApp group links
  const whatsappLinks: string[] = [];
  const whatsappRegex = /chat\.whatsapp\.com\/([A-Za-z0-9]{20,25})/g;
  let whatsappMatch;
  
  // Check URL
  if (url.includes('chat.whatsapp.com')) {
    const urlMatch = url.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{20,25})/);
    if (urlMatch) whatsappLinks.push(`https://chat.whatsapp.com/${urlMatch[1]}`);
  }
  
  // Check text content for WhatsApp links
  while ((whatsappMatch = whatsappRegex.exec(text)) !== null) {
    const link = `https://chat.whatsapp.com/${whatsappMatch[1]}`;
    if (!whatsappLinks.includes(link)) {
      whatsappLinks.push(link);
    }
  }
  
  if (whatsappLinks.length > 0) {
    handles.whatsapp = whatsappLinks;
  }
  
  return handles;
}

// Helper to extract website contact pages from text
function extractWebsites(text: string, excludeUrl: string): string[] {
  const websiteRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+)(?:\/[^\s]*)?/g;
  const matches = text.match(websiteRegex) || [];
  
  return [...new Set(matches)]
    .filter(url => 
      !url.includes(excludeUrl.split('/')[2]) && // Exclude same domain
      !url.includes('google.com') &&
      !url.includes('facebook.com') &&
      !url.includes('twitter.com') &&
      !url.includes('reddit.com') &&
      url.length < 100
    )
    .slice(0, 3);
}

// Helper to categorize result type
function categorizeResult(url: string, title: string): string {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();
  
  if (lowerUrl.includes('linkedin.com/in/')) return 'linkedin_profile';
  if (lowerUrl.includes('linkedin.com/company')) return 'linkedin_company';
  if (lowerUrl.includes('chat.whatsapp.com')) return 'whatsapp_group';
  if (lowerUrl.includes('reddit.com/r/') && lowerUrl.includes('/comments/')) return 'reddit_post';
  if (lowerUrl.includes('reddit.com/r/')) return 'reddit_community';
  if (lowerUrl.includes('quora.com/profile')) return 'quora_profile';
  if (lowerTitle.includes('consultant') || lowerTitle.includes('advisor') || lowerTitle.includes('counsellor')) return 'consultant';
  if (lowerTitle.includes('contact') || lowerUrl.includes('/contact')) return 'contact_page';
  return 'general';
}

export async function POST(request: Request) {
  try {
    const { queries, category, numResults = 15, includeText = true }: ExaSearchParams = await request.json();

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json({ error: 'queries array is required' }, { status: 400 });
    }

    const allResults: any[] = [];
    const toolTrace: string[] = [];

    // Allow up to 5 queries for comprehensive coverage
    for (const query of queries.slice(0, 5)) {
      toolTrace.push(`🔍 exa.searchAndContents("${query}", { type: "neural", numResults: ${numResults} })`);

      try {
        const searchOptions: any = {
          type: 'neural' as const, // Neural search is better for finding people
          numResults,
          highlights: { 
            numSentences: 5,        // Get more context for extraction
            highlightsPerUrl: 3,
          },
        };
        
        // Only add text if we want full content (costs more but better extraction)
        if (includeText) {
          searchOptions.text = { maxCharacters: 4000 }; // Get actual page text
        }
        
        if (category) searchOptions.category = category;

        const results = await exa.searchAndContents(query, searchOptions);

        for (const r of results.results) {
          const textContent = (r as any).text || '';
          const highlightText = ((r as any).highlights || []).join(' ');
          const combinedText = `${textContent} ${highlightText} ${r.title || ''}`;
          
          // Extract contact information
          const emails = extractEmails(combinedText);
          const phones = extractPhones(combinedText);
          const socialHandles = extractSocialHandles(combinedText, r.url || '');
          const nameFromUrl = extractNameFromUrl(r.url || '');
          const websites = extractWebsites(combinedText, r.url || '');
          const resultType = categorizeResult(r.url || '', r.title || '');
          
          allResults.push({
            title: r.title || '',
            url: r.url || '',
            highlights: (r as any).highlights || [],
            text: textContent.substring(0, 2000), // Keep more text for context
            publishedDate: r.publishedDate || null,
            author: r.author || nameFromUrl || null,
            resultType: resultType, // linkedin_profile, whatsapp_group, reddit_post, etc.
            // Extracted contact info
            extractedData: {
              emails: emails.slice(0, 5),
              phones: phones.slice(0, 3),
              linkedin: socialHandles.linkedin || null,
              twitter: socialHandles.twitter || null,
              whatsappGroups: socialHandles.whatsapp || [],
              nameFromUrl: nameFromUrl,
              relatedWebsites: websites,
            }
          });
        }

        toolTrace.push(`  ✅ Found ${results.results.length} results`);
      } catch (err: any) {
        toolTrace.push(`  ⚠️ Search failed: ${err.message}`);
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const unique = allResults.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    return NextResponse.json({
      success: true,
      results: unique,
      toolTrace,
      totalResults: unique.length,
    });
  } catch (error: any) {
    console.error('Exa research error:', error);
    return NextResponse.json(
      { error: error.message || 'Exa research failed' },
      { status: 500 }
    );
  }
}
