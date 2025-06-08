/**
 * Enhanced Crawler Button Component
 * 
 * Provides a button that can crawl a URL and populate the data management system
 * with extracted page content.
 */

import React, { useState } from 'react';
import { ExtractedPageContent } from '../types/types';

interface CrawlerButtonProps {
  url: string;
  onPagesExtracted: (pages: ExtractedPageContent[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

export const CrawlerButton: React.FC<CrawlerButtonProps> = ({
  url,
  onPagesExtracted,
  onError,
  disabled = false,
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');

  const handleCrawl = async () => {
    if (!url || isLoading) return;

    setIsLoading(true);
    setProgress('Starting crawl...');

    try {
      const response = await fetch('/api/crawl-enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.pages) {
        setProgress(`Extracted ${data.pages.length} pages`);
        onPagesExtracted(data.pages);
        
        setTimeout(() => {
          setProgress('');
        }, 3000);
      } else {
        throw new Error(data.error || 'Crawling failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setProgress(`Error: ${errorMessage}`);
      
      if (onError) {
        onError(errorMessage);
      }
      
      setTimeout(() => {
        setProgress('');
      }, 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleCrawl}
        disabled={disabled || isLoading || !url}
        className={`w-full px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {isLoading ? 'Crawling...' : 'Extract Data'}
      </button>
      
      {progress && (
        <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded border">
          {progress}
        </div>
      )}
    </div>
  );
};
