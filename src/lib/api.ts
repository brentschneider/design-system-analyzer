import { DesignSystemSource, Component, CrawlProgress } from '../types/types';

export type SourceStatus = 'idle' | 'crawling' | 'analyzing' | 'complete' | 'error';

export interface ContentChunk {
  id: string;
  content: string;
  type: 'html' | 'markdown' | 'jsx' | 'tsx';
  metadata?: Record<string, unknown>;
}

export async function crawlDesignSystemSource(
  source: DesignSystemSource,
  onProgress: (progress: CrawlProgress) => void
): Promise<ContentChunk[]> {
  try {
    const response = await fetch('/api/crawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceId: source.id,
        url: source.url,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to crawl design system');
    }

    // Mock progress updates
    onProgress({
      sourceId: source.id,
      pagesProcessed: 1,
      totalPages: 1,
      currentPage: source.url
    });
    
    return response.json();
  } catch (error) {
    console.error('Error crawling design system:', error);
    throw error;
  }
}

export async function analyzeContent(chunks: ContentChunk[]): Promise<Component[]> {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chunks }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to analyze content');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error analyzing content:', error);
    throw error;
  }
}

export async function processDesignSystem(
  source: DesignSystemSource,
  onProgress: (progress: CrawlProgress) => void,
  onUpdateSource: (status: SourceStatus, error?: string) => void,
  onAddComponent: (component: Component) => void
) {
  try {
    // Update status to crawling
    onUpdateSource('crawling');
    
    // Crawl content
    const chunks = await crawlDesignSystemSource(source, onProgress);
    
    // Update status to analyzing
    onUpdateSource('analyzing');
    
    // Analyze content
    const componentResults = await analyzeContent(chunks);
    
    // Ensure we have an array of results to process
    const results = Array.isArray(componentResults) ? componentResults : [];

    // Convert results to components and add them
    results.forEach((result) => {
      if (result?.name) {
        const component = {
          id: `component-${Date.now()}-${Math.random()}`,
          sourceId: source.id,
          name: result.name,
          description: result.description || '',
          props: result.props || [],
          codeSnippets: result.codeSnippets || [],
          relationships: result.relationships || [],
          metadata: result.metadata || {},
          sourceUrl: chunks.find((c) => c.metadata?.componentId === result.id)?.metadata?.sourceUrl as string || ''
        };
        onAddComponent(component);
      }
    });

    // Update status to complete
    onUpdateSource('complete');
  } catch (error) {
    onUpdateSource('error', error instanceof Error ? error.message : 'Unknown error occurred');
    throw error;
  }
}
