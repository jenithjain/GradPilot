import { NextResponse } from 'next/server';
import Exa from 'exa-js';

const exa = new Exa(process.env.EXA_API_KEY);

interface ExaSearchParams {
  queries: string[];
  category?: 'people' | 'company' | 'news' | 'research paper';
  numResults?: number;
}

export async function POST(request: Request) {
  try {
    const { queries, category, numResults = 10 }: ExaSearchParams = await request.json();

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json({ error: 'queries array is required' }, { status: 400 });
    }

    const allResults: any[] = [];
    const toolTrace: string[] = [];

    for (const query of queries.slice(0, 5)) {
      toolTrace.push(`🔍 exa.searchAndContents("${query}", { type: "auto", category: "${category || 'auto'}", numResults: ${numResults} })`);

      try {
        const searchOptions: any = {
          type: 'auto' as const,
          numResults,
          highlights: { maxCharacters: 4000 },
        };
        if (category) searchOptions.category = category;

        const results = await exa.searchAndContents(query, searchOptions);

        for (const r of results.results) {
          allResults.push({
            title: r.title || '',
            url: r.url || '',
            highlights: (r as any).highlights || [],
            publishedDate: r.publishedDate || null,
            author: r.author || null,
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
