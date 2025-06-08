import { NextResponse } from 'next/server';
import { crawlDesignSystem } from '../../../lib/crawler';
import { ExtractedPageContent } from '../../../types/types';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ 
        error: 'URL is required' 
      }, { status: 400 });
    }
    
    console.log(`🌐 Starting enhanced crawl of: ${url}`);
    console.log('⚙️ Using enhanced extraction settings');
    
    const pages: ExtractedPageContent[] = [];
    
    // Use the enhanced crawler
    const extractedPages = await crawlDesignSystem(
      url,
      (progress) => {
        console.log(`Progress: ${progress.pagesProcessed}/${progress.totalPages} - ${progress.currentPage}`);
      }
    );
    
    pages.push(...extractedPages);
    
    console.log(`Crawl complete. Extracted ${pages.length} pages.`);
    
    // Return comprehensive data in unified format
    return NextResponse.json({ 
      success: true, 
      pages,
      summary: {
        totalPages: pages.length,
        totalCodeSamples: pages.reduce((sum, page) => sum + page.codeSamples.length, 0),
        totalTextContent: pages.reduce((sum, page) => sum + page.textContent.length, 0),
        languagesDetected: [...new Set(
          pages.flatMap(page => 
            page.codeSamples
              .map(sample => sample.language || sample.detectedLanguage)
              .filter(Boolean)
          )
        )],
        crawledUrls: pages.map(page => page.url),
        errors: pages.filter(page => page.errors && page.errors.length > 0).map(page => ({
          url: page.url,
          errors: page.errors
        }))
      }
    });
  } catch (error) {
    console.error('Enhanced crawl error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Enhanced crawl failed',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Enhanced Web Crawler API',
    description: 'Renders pages in headless browser and extracts semantic content, metadata, and code samples',
    features: [
      'Headless browser rendering with Puppeteer',
      'Semantic content extraction (headings, paragraphs, lists, etc.)',
      'Metadata extraction (title, description, Open Graph, JSON-LD)',
      'Code sample detection with language identification',
      'ARIA labels and accessibility content',
      'Unified JSON format output'
    ],
    usage: {
      method: 'POST',
      body: {
        sourceId: 'string',
        url: 'string (URL to crawl)'
      }
    }
  });
}
