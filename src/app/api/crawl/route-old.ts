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

export async function POST(request: Request) {
  try {
    const { sourceId, url } = await request.json();
    
    // Create an AbortController to handle timeouts and cancellation
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minute timeout
    
    const chunks: ContentChunk[] = [];
    const progress: CrawlProgress = {
      sourceId,
      pagesProcessed: 0,
      totalPages: 0,
      componentsFound: 0,
      currentPage: url
    };

    // Create WebSocket connection if supported
    let ws: WebSocket | null = null;
    try {
      if (typeof window !== 'undefined') {
        ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`);
      }
    } catch (error) {
      console.warn('WebSocket connection failed:', error);
    }

    // Crawl the design system and collect chunks
    const crawledChunks = await crawlDesignSystem(
      url,
      (progressUpdate: CrawlProgress) => {
        // Update local progress
        progress.pagesProcessed = progressUpdate.pagesProcessed;
        progress.totalPages = progressUpdate.totalPages;
        progress.componentsFound = progressUpdate.componentsFound;
        progress.currentPage = progressUpdate.currentPage;
        
        // Send progress via WebSocket if available
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'progress',
            sourceId,
            progress: progressUpdate
          }));
        }
        
        console.log('Progress:', progress);
      },
      controller.signal
    );
    
    chunks.push(...crawledChunks);
    clearTimeout(timeout);
    
    // Close WebSocket connection
    if (ws?.readyState === WebSocket.OPEN) {
      ws.close();
    }
    
    return NextResponse.json({ 
      success: true, 
      chunks,
      progress: {
        pagesProcessed: progress.pagesProcessed,
        totalPages: progress.totalPages,
        componentsFound: chunks.length,
        currentPage: progress.currentPage
      }
    });
  } catch (error: any) {
    console.error('Crawl error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while crawling' },
      { status: 500 }
    );
  }
}
