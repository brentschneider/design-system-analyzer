import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    
    // Simple mock crawl for testing
    const chunks = [{
      id: `chunk-${Date.now()}`,
      content: `<h1>Button Component</h1><p>A reusable button component</p><ul><li>variant: primary | secondary</li><li>size: small | medium | large</li></ul>`,
      type: 'html' as const,
      metadata: { sourceUrl: url }
    }];
    
    return NextResponse.json({ 
      success: true, 
      chunks,
      progress: { pagesProcessed: 1, totalPages: 1, componentsFound: 1, currentPage: url }
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Crawl failed' 
    }, { status: 500 });
  }
}
