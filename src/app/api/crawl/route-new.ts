import { NextResponse } from 'next/server';
import { ContentChunk } from '../../../types/types';

export async function POST(request: Request) {
  try {
    const { sourceId, url } = await request.json();
    
    // Simplified crawl - just fetch the main page
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Design System Analyzer' }
    });
    
    const html = await response.text();
    
    // Create a simple chunk from the content
    const chunks: ContentChunk[] = [{
      id: `chunk-${sourceId}-1`,
      content: html.substring(0, 2000), // First 2000 chars
      type: 'html',
      metadata: { sourceUrl: url }
    }];
    
    return NextResponse.json({ 
      success: true, 
      chunks,
      progress: {
        pagesProcessed: 1,
        totalPages: 1,
        componentsFound: 1,
        currentPage: url
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Crawl failed' },
      { status: 500 }
    );
  }
}
