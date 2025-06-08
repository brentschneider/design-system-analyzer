/**
 * Crawler Integration Utilities
 * 
 * Provides functions to connect the crawler output with the data management system
 * and enhance the user experience with real-time data updates.
 */

import { ExtractedPageContent, CrawlProgress } from '../types/types';
import { autoSaveManager } from './dataIntegration';

/**
 * Enhanced crawler that integrates with the data management system
 */
export class IntegratedCrawler {
  private onPagesUpdate?: (pages: ExtractedPageContent[]) => void;
  private onProgressUpdate?: (progress: CrawlProgress) => void;
  private currentPages: ExtractedPageContent[] = [];

  constructor(
    onPagesUpdate?: (pages: ExtractedPageContent[]) => void,
    onProgressUpdate?: (progress: CrawlProgress) => void
  ) {
    this.onPagesUpdate = onPagesUpdate;
    this.onProgressUpdate = onProgressUpdate;
  }

  /**
   * Crawl a design system and update the data management system in real-time
   */
  async crawlWithIntegration(url: string, signal?: AbortSignal): Promise<ExtractedPageContent[]> {
    this.currentPages = [];
    
    try {
      const response = await fetch('/api/crawl-enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
        signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.pages) {
        this.currentPages = data.pages;
        
        // Update the UI immediately
        if (this.onPagesUpdate) {
          this.onPagesUpdate(this.currentPages);
        }

        // Auto-save the results
        autoSaveManager.autoSave(this.currentPages);

        // Final progress update
        if (this.onProgressUpdate) {
          this.onProgressUpdate({
            sourceId: url,
            pagesProcessed: this.currentPages.length,
            totalPages: this.currentPages.length,
            componentsFound: this.currentPages.length,
            currentPage: 'Complete'
          });
        }

        return this.currentPages;
      } else {
        throw new Error(data.error || 'Crawling failed');
      }
    } catch (error) {
      console.error('Integrated crawl failed:', error);
      throw error;
    }
  }

  /**
   * Get current pages
   */
  getCurrentPages(): ExtractedPageContent[] {
    return this.currentPages;
  }

  /**
   * Clear current pages
   */
  clearPages(): void {
    this.currentPages = [];
    if (this.onPagesUpdate) {
      this.onPagesUpdate([]);
    }
  }
}

/**
 * Hook to manage crawler integration with React state
 */
export function useCrawlerIntegration() {
  const [pages, setPages] = useState<ExtractedPageContent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<CrawlProgress | null>(null);

  const crawler = useRef<IntegratedCrawler | null>(null);

  useEffect(() => {
    crawler.current = new IntegratedCrawler(setPages, setProgress);
  }, []);

  const crawlUrl = useCallback(async (url: string) => {
    if (!crawler.current) return;

    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      await crawler.current.crawlWithIntegration(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crawling failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    if (crawler.current) {
      crawler.current.clearPages();
    }
    setError(null);
    setProgress(null);
  }, []);

  return {
    pages,
    isLoading,
    error,
    progress,
    crawlUrl,
    clearData,
    setPages // Allow manual page updates
  };
}

// Import required hooks for the above function
import { useState, useEffect, useRef, useCallback } from 'react';
