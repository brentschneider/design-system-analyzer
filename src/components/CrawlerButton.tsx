'use client';

/**
 * Enhanced Crawler Button Component
 * 
 * Provides a button that can crawl a URL and populate the data management system
 * with extracted page content.
 */

import React, { useState } from 'react';
import { ExtractedPageContent } from '../types/types';
import { convertPagesToComponents } from '../lib/dataIntegration';
import { store } from '../store/store';
import { addComponent, addSource } from '../store/designSystemSlice';

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
        console.log('🎯 Received crawler response:', {
          pageCount: data.pages.length,
          summary: data.summary
        });

        setProgress(`Extracted ${data.pages.length} pages`);
        
        // Log details about the extracted content
        data.pages.forEach((page: ExtractedPageContent, index: number) => {
          console.log(`\n📄 Page ${index + 1}: ${page.url}`);
          console.log(`   - Headings: ${page.semanticContent.headings.length}`);
          console.log(`   - Code samples: ${page.codeSamples.length}`);
          console.log(`   - Paragraphs: ${page.semanticContent.paragraphs.length}`);
          
          // Log some samples
          if (page.semanticContent.headings.length > 0) {
            console.log('   Sample headings:', page.semanticContent.headings.slice(0, 3));
          }
          if (page.codeSamples.length > 0) {
            console.log('   Sample code:', page.codeSamples[0].code.substring(0, 100));
          }
        });

        // Convert pages to components
        console.log('Converting pages to components...');
        const components = convertPagesToComponents(data.pages);
        
        // Add source to Redux store
        store.dispatch(addSource({ url, name: new URL(url).hostname }));
        
        // Get the source ID that was generated in the store
        const sourceId = `source-${url.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
        
        // Add components to Redux store with source reference
        console.log('Adding components to store:', components.length);
        components.forEach((component) => {
          store.dispatch(addComponent({
            ...component,
            sourceId
          }));
          console.log('Added component:', component.name);
        });
        
        // Notify parent about extracted pages
        console.log('Notifying about extracted pages');
        onPagesExtracted(data.pages);
        
        setTimeout(() => {
          setProgress(`Found ${components.length} components in ${data.pages.length} pages`);
        }, 1000);
        
        setTimeout(() => {
          setProgress('');
        }, 4000);
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
