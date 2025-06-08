/**
 * Enhanced Data Management Utilities
 * 
 * Provides comprehensive utility functions for data processing, validation,
 * transformation, and analysis of extracted page content.
 */

import { ExtractedPageContent } from '../types/types';
import { ExportOptions, ExportResult, exportPages } from './export';

// ==================== VALIDATION & SANITIZATION ====================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    totalPages: number;
    validPages: number;
    errorPages: number;
    emptyPages: number;
    duplicateUrls: number;
  };
}

/**
 * Comprehensive validation of extracted page content
 */
export function validatePageContent(pages: ExtractedPageContent[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let validPages = 0;
  let errorPages = 0;
  let emptyPages = 0;
  
  // Track URLs to detect duplicates
  const urlCounts = new Map<string, number>();
  
  pages.forEach((page, index) => {
    let pageIsValid = true;
    
    // Required field validation
    if (!page.id) {
      errors.push(`Page ${index}: Missing required field 'id'`);
      pageIsValid = false;
    }
    
    if (!page.url) {
      errors.push(`Page ${index}: Missing required field 'url'`);
      pageIsValid = false;
    } else {
      // URL validation
      try {
        new URL(page.url);
        urlCounts.set(page.url, (urlCounts.get(page.url) || 0) + 1);
      } catch {
        errors.push(`Page ${index}: Invalid URL format '${page.url}'`);
        pageIsValid = false;
      }
    }
    
    if (!page.timestamp) {
      errors.push(`Page ${index}: Missing required field 'timestamp'`);
      pageIsValid = false;
    } else {
      // Timestamp validation
      try {
        new Date(page.timestamp);
      } catch {
        errors.push(`Page ${index}: Invalid timestamp format '${page.timestamp}'`);
        pageIsValid = false;
      }
    }
    
    // Content validation
    if (!page.textContent || page.textContent.trim().length === 0) {
      warnings.push(`Page ${index}: Empty text content`);
      emptyPages++;
    }
    
    // Semantic content validation
    if (!page.semanticContent) {
      warnings.push(`Page ${index}: Missing semantic content`);
    } else {
      if (!Array.isArray(page.semanticContent.headings)) {
        errors.push(`Page ${index}: Invalid headings structure`);
        pageIsValid = false;
      }
      if (!Array.isArray(page.semanticContent.paragraphs)) {
        errors.push(`Page ${index}: Invalid paragraphs structure`);
        pageIsValid = false;
      }
    }
    
    // Code samples validation
    if (page.codeSamples && Array.isArray(page.codeSamples)) {
      page.codeSamples.forEach((sample, sampleIndex) => {
        if (!sample.code || sample.code.trim().length === 0) {
          warnings.push(`Page ${index}, Sample ${sampleIndex}: Empty code content`);
        }
        if (!sample.id) {
          warnings.push(`Page ${index}, Sample ${sampleIndex}: Missing sample ID`);
        }
      });
    }
    
    // Error tracking
    if (page.errors && page.errors.length > 0) {
      errorPages++;
    }
    
    if (pageIsValid) {
      validPages++;
    }
  });
  
  // Check for duplicate URLs
  const duplicateUrls = Array.from(urlCounts.entries())
    .filter(([, count]) => count > 1)
    .length;
    
  if (duplicateUrls > 0) {
    warnings.push(`Found ${duplicateUrls} duplicate URLs`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      totalPages: pages.length,
      validPages,
      errorPages,
      emptyPages,
      duplicateUrls
    }
  };
}

/**
 * Sanitize and clean page content
 */
export function sanitizePageContent(page: ExtractedPageContent): ExtractedPageContent {
  const sanitized: ExtractedPageContent = {
    ...page,
    textContent: page.textContent?.trim() || '',
    semanticContent: {
      headings: page.semanticContent?.headings?.filter(h => h.text?.trim()) || [],
      paragraphs: page.semanticContent?.paragraphs?.filter(p => p?.trim()) || [],
      lists: page.semanticContent?.lists?.filter(l => l.items?.length > 0) || [],
      altTexts: page.semanticContent?.altTexts?.filter(a => a?.trim()) || [],
      ariaLabels: page.semanticContent?.ariaLabels?.filter(a => a?.trim()) || [],
      landmarks: page.semanticContent?.landmarks?.filter(l => l.role?.trim()) || []
    },
    codeSamples: page.codeSamples?.filter(sample => sample.code?.trim()) || [],
    errors: page.errors?.filter(error => error?.trim()) || []
  };
  
  return sanitized;
}

// ==================== DATA TRANSFORMATION & FILTERING ====================

export interface FilterOptions {
  minTextLength?: number;
  maxTextLength?: number;
  includeWithErrors?: boolean;
  requireCodeSamples?: boolean;
  urlPatterns?: string[];
  excludeUrlPatterns?: string[];
  languages?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Filter pages based on criteria
 */
export function filterPages(pages: ExtractedPageContent[], options: FilterOptions): ExtractedPageContent[] {
  return pages.filter(page => {
    // Text length filtering
    if (options.minTextLength && page.textContent.length < options.minTextLength) {
      return false;
    }
    
    if (options.maxTextLength && page.textContent.length > options.maxTextLength) {
      return false;
    }
    
    // Error filtering
    if (options.includeWithErrors === false && page.errors && page.errors.length > 0) {
      return false;
    }
    
    // Code samples requirement
    if (options.requireCodeSamples && (!page.codeSamples || page.codeSamples.length === 0)) {
      return false;
    }
    
    // URL pattern filtering
    if (options.urlPatterns && options.urlPatterns.length > 0) {
      const matchesPattern = options.urlPatterns.some(pattern => 
        new RegExp(pattern).test(page.url)
      );
      if (!matchesPattern) {
        return false;
      }
    }
    
    // URL exclusion patterns
    if (options.excludeUrlPatterns && options.excludeUrlPatterns.length > 0) {
      const matchesExcludePattern = options.excludeUrlPatterns.some(pattern => 
        new RegExp(pattern).test(page.url)
      );
      if (matchesExcludePattern) {
        return false;
      }
    }
    
    // Language filtering
    if (options.languages && options.languages.length > 0) {
      const pageLanguages = page.codeSamples
        .map(sample => sample.language || sample.detectedLanguage)
        .filter(Boolean);
        
      const hasMatchingLanguage = options.languages.some(lang => 
        pageLanguages.includes(lang)
      );
      
      if (!hasMatchingLanguage && page.codeSamples.length > 0) {
        return false;
      }
    }
    
    // Date range filtering
    if (options.dateRange) {
      const pageDate = new Date(page.timestamp);
      if (pageDate < options.dateRange.start || pageDate > options.dateRange.end) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Sort pages by various criteria
 */
export function sortPages(
  pages: ExtractedPageContent[], 
  sortBy: 'timestamp' | 'url' | 'textLength' | 'codeSamplesCount' | 'renderTime',
  order: 'asc' | 'desc' = 'desc'
): ExtractedPageContent[] {
  const sorted = [...pages].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'timestamp':
        comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        break;
      case 'url':
        comparison = a.url.localeCompare(b.url);
        break;
      case 'textLength':
        comparison = a.textContent.length - b.textContent.length;
        break;
      case 'codeSamplesCount':
        comparison = (a.codeSamples?.length || 0) - (b.codeSamples?.length || 0);
        break;
      case 'renderTime':
        comparison = (a.renderTime || 0) - (b.renderTime || 0);
        break;
    }
    
    return order === 'asc' ? comparison : -comparison;
  });
  
  return sorted;
}

// ==================== DATA MERGING & DEDUPLICATION ====================

/**
 * Merge multiple page datasets, handling duplicates intelligently
 */
export function mergePageDatasets(
  datasets: ExtractedPageContent[][],
  deduplicateStrategy: 'keepFirst' | 'keepLast' | 'keepBest' = 'keepBest'
): ExtractedPageContent[] {
  const urlMap = new Map<string, ExtractedPageContent[]>();
  
  // Group pages by URL
  datasets.forEach(dataset => {
    dataset.forEach(page => {
      if (!urlMap.has(page.url)) {
        urlMap.set(page.url, []);
      }
      urlMap.get(page.url)!.push(page);
    });
  });
  
  // Resolve duplicates
  const mergedPages: ExtractedPageContent[] = [];
  
  urlMap.forEach((pages) => {
    if (pages.length === 1) {
      mergedPages.push(pages[0]);
    } else {
      let selectedPage: ExtractedPageContent;
      
      switch (deduplicateStrategy) {
        case 'keepFirst':
          selectedPage = pages[0];
          break;
        case 'keepLast':
          selectedPage = pages[pages.length - 1];
          break;
        case 'keepBest':
          // Select page with most content and least errors
          selectedPage = pages.reduce((best, current) => {
            const bestScore = calculatePageQualityScore(best);
            const currentScore = calculatePageQualityScore(current);
            return currentScore > bestScore ? current : best;
          });
          break;
      }
      
      mergedPages.push(selectedPage);
    }
  });
  
  return mergedPages;
}

/**
 * Calculate a quality score for a page
 */
function calculatePageQualityScore(page: ExtractedPageContent): number {
  let score = 0;
  
  // Text content weight
  score += Math.min(page.textContent.length / 1000, 10) * 2;
  
  // Semantic content weight
  score += (page.semanticContent?.headings?.length || 0) * 0.5;
  score += Math.min(page.semanticContent?.paragraphs?.length || 0, 20) * 0.1;
  
  // Code samples weight
  score += (page.codeSamples?.length || 0) * 3;
  
  // Metadata completeness weight
  if (page.metadata?.title) score += 1;
  if (page.metadata?.description) score += 1;
  
  // Penalize errors
  score -= (page.errors?.length || 0) * 2;
  
  // Render time bonus (faster is better)
  if (page.renderTime && page.renderTime < 5000) {
    score += 1;
  }
  
  return Math.max(score, 0);
}

// ==================== BATCH PROCESSING ====================

export interface BatchProcessingOptions {
  batchSize?: number;
  concurrency?: number;
  onProgress?: (processed: number, total: number) => void;
  onError?: (error: Error, item: ExtractedPageContent, index: number) => void;
}

/**
 * Process pages in batches with concurrency control
 */
export async function batchProcessPages<T>(
  pages: ExtractedPageContent[],
  processor: (page: ExtractedPageContent, index: number) => Promise<T>,
  options: BatchProcessingOptions = {}
): Promise<T[]> {
  const {
    batchSize = 10,
    concurrency = 3,
    onProgress,
    onError
  } = options;
  
  const results: T[] = [];
  const errors: { index: number; error: Error }[] = [];
  
  // Process in batches
  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const batchPromises = batch.map(async (page, batchIndex) => {
      const globalIndex = i + batchIndex;
      
      try {
        return await processor(page, globalIndex);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ index: globalIndex, error: err });
        
        if (onError) {
          onError(err, page, globalIndex);
        }
        
        return null;
      }
    });
    
    // Process with concurrency limit
    const batchResults = await Promise.allSettled(
      batchPromises.slice(0, concurrency)
    );
    
    // Handle remaining items if batch size > concurrency
    if (batch.length > concurrency) {
      const remainingPromises = batchPromises.slice(concurrency);
      const remainingResults = await Promise.allSettled(remainingPromises);
      batchResults.push(...remainingResults);
    }
    
    // Collect successful results
    batchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value !== null) {
        results.push(result.value);
      }
    });
    
    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + batchSize, pages.length), pages.length);
    }
  }
  
  return results;
}

// ==================== ANALYSIS & INSIGHTS ====================

export interface DataInsights {
  overview: {
    totalPages: number;
    totalTextLength: number;
    totalCodeSamples: number;
    averageRenderTime: number;
    uniqueDomains: number;
    timeRange: {
      earliest: string;
      latest: string;
    };
  };
  contentAnalysis: {
    mostCommonHeadings: Array<{ text: string; count: number }>;
    languageDistribution: Array<{ language: string; count: number }>;
    averageContentLength: number;
    pagesWithErrors: number;
  };
  technicalMetrics: {
    renderTimeDistribution: {
      fast: number; // < 2s
      medium: number; // 2-5s
      slow: number; // > 5s
    };
    codeComplexity: {
      averageCodeLength: number;
      maxCodeLength: number;
      minCodeLength: number;
    };
  };
  recommendations: string[];
}

/**
 * Generate comprehensive insights from page data
 */
export function generateDataInsights(pages: ExtractedPageContent[]): DataInsights {
  if (pages.length === 0) {
    return {
      overview: {
        totalPages: 0,
        totalTextLength: 0,
        totalCodeSamples: 0,
        averageRenderTime: 0,
        uniqueDomains: 0,
        timeRange: { earliest: '', latest: '' }
      },
      contentAnalysis: {
        mostCommonHeadings: [],
        languageDistribution: [],
        averageContentLength: 0,
        pagesWithErrors: 0
      },
      technicalMetrics: {
        renderTimeDistribution: { fast: 0, medium: 0, slow: 0 },
        codeComplexity: {
          averageCodeLength: 0,
          maxCodeLength: 0,
          minCodeLength: 0
        }
      },
      recommendations: ['No data available for analysis']
    };
  }
  
  // Overview metrics
  const totalTextLength = pages.reduce((sum, page) => sum + page.textContent.length, 0);
  const totalCodeSamples = pages.reduce((sum, page) => sum + (page.codeSamples?.length || 0), 0);
  const renderTimes = pages.map(page => page.renderTime || 0).filter(time => time > 0);
  const averageRenderTime = renderTimes.length > 0 
    ? renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length 
    : 0;
  
  const domains = new Set(pages.map(page => {
    try {
      return new URL(page.url).hostname;
    } catch {
      return 'unknown';
    }
  }));
  
  const timestamps = pages.map(page => new Date(page.timestamp)).sort();
  const timeRange = {
    earliest: timestamps[0]?.toISOString() || '',
    latest: timestamps[timestamps.length - 1]?.toISOString() || ''
  };
  
  // Content analysis
  const headingCounts = new Map<string, number>();
  const languageCounts = new Map<string, number>();
  let pagesWithErrors = 0;
  
  pages.forEach(page => {
    // Count headings
    page.semanticContent?.headings?.forEach(heading => {
      const text = heading.text.toLowerCase().trim();
      headingCounts.set(text, (headingCounts.get(text) || 0) + 1);
    });
    
    // Count languages
    page.codeSamples?.forEach(sample => {
      const language = sample.language || sample.detectedLanguage || 'unknown';
      languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
    });
    
    // Count errors
    if (page.errors && page.errors.length > 0) {
      pagesWithErrors++;
    }
  });
  
  const mostCommonHeadings = Array.from(headingCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([text, count]) => ({ text, count }));
    
  const languageDistribution = Array.from(languageCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([language, count]) => ({ language, count }));
  
  // Technical metrics
  let fast = 0, medium = 0, slow = 0;
  renderTimes.forEach(time => {
    if (time < 2000) fast++;
    else if (time < 5000) medium++;
    else slow++;
  });
  
  const codeLengths = pages
    .flatMap(page => page.codeSamples || [])
    .map(sample => sample.code.length)
    .filter(length => length > 0);
    
  const codeComplexity = {
    averageCodeLength: codeLengths.length > 0 
      ? codeLengths.reduce((sum, len) => sum + len, 0) / codeLengths.length 
      : 0,
    maxCodeLength: Math.max(...codeLengths, 0),
    minCodeLength: Math.min(...codeLengths, 0)
  };
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (pagesWithErrors > pages.length * 0.1) {
    recommendations.push(`High error rate: ${pagesWithErrors} pages have errors. Consider reviewing crawling configuration.`);
  }
  
  if (averageRenderTime > 5000) {
    recommendations.push('Slow average render time detected. Consider optimizing target websites or crawling strategy.');
  }
  
  if (totalCodeSamples < pages.length * 0.3) {
    recommendations.push('Low code sample detection rate. Consider improving code detection patterns.');
  }
  
  if (domains.size === 1) {
    recommendations.push('Data from single domain detected. Consider diversifying sources for broader analysis.');
  }
  
  if (languageDistribution.length > 10) {
    recommendations.push('Many programming languages detected. Consider focusing on primary languages for better analysis.');
  }
  
  return {
    overview: {
      totalPages: pages.length,
      totalTextLength,
      totalCodeSamples,
      averageRenderTime,
      uniqueDomains: domains.size,
      timeRange
    },
    contentAnalysis: {
      mostCommonHeadings,
      languageDistribution,
      averageContentLength: totalTextLength / pages.length,
      pagesWithErrors
    },
    technicalMetrics: {
      renderTimeDistribution: { fast, medium, slow },
      codeComplexity
    },
    recommendations
  };
}

// ==================== SEARCH & QUERY ====================

export interface SearchOptions {
  caseSensitive?: boolean;
  regex?: boolean;
  searchIn?: ('textContent' | 'headings' | 'codeSamples' | 'metadata')[];
  limit?: number;
}

/**
 * Search through page content
 */
export function searchPages(
  pages: ExtractedPageContent[],
  query: string,
  options: SearchOptions = {}
): ExtractedPageContent[] {
  const {
    caseSensitive = false,
    regex = false,
    searchIn = ['textContent', 'headings', 'codeSamples', 'metadata'],
    limit
  } = options;
  
  let searchPattern: RegExp;
  
  try {
    if (regex) {
      searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } else {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchPattern = new RegExp(escapedQuery, caseSensitive ? 'g' : 'gi');
    }
  } catch {
    // Fallback to simple string search if regex is invalid
    searchPattern = new RegExp(
      query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      caseSensitive ? 'g' : 'gi'
    );
  }
  
  const results = pages.filter(page => {
    // Search in text content
    if (searchIn.includes('textContent') && searchPattern.test(page.textContent)) {
      return true;
    }
    
    // Search in headings
    if (searchIn.includes('headings') && page.semanticContent?.headings) {
      const headingMatch = page.semanticContent.headings.some(heading => 
        searchPattern.test(heading.text)
      );
      if (headingMatch) return true;
    }
    
    // Search in code samples
    if (searchIn.includes('codeSamples') && page.codeSamples) {
      const codeMatch = page.codeSamples.some(sample => 
        searchPattern.test(sample.code) || 
        (sample.context && searchPattern.test(sample.context))
      );
      if (codeMatch) return true;
    }
    
    // Search in metadata
    if (searchIn.includes('metadata') && page.metadata) {
      const metadataText = [
        page.metadata.title,
        page.metadata.description,
        ...(page.metadata.keywords || [])
      ].join(' ');
      
      if (searchPattern.test(metadataText)) return true;
    }
    
    return false;
  });
  
  return limit ? results.slice(0, limit) : results;
}

// ==================== EXPORT UTILITIES ====================

/**
 * Batch export multiple datasets in different formats
 */
export async function batchExport(
  datasets: { name: string; pages: ExtractedPageContent[] }[],
  baseOptions: Omit<ExportOptions, 'filename'>
): Promise<Array<{ name: string; result: ExportResult }>> {
  const exports = await Promise.all(
    datasets.map(async ({ name, pages }) => {
      const options: ExportOptions = {
        ...baseOptions,
        filename: `${name}-${new Date().toISOString().split('T')[0]}`
      };
      
      const result = exportPages(pages, options);
      return { name, result };
    })
  );
  
  return exports;
}

/**
 * Create a summary export of insights
 */
export function exportInsights(insights: DataInsights, filename?: string): ExportResult {
  const timestamp = new Date().toISOString();
  const exportFilename = filename || `insights-${timestamp.split('T')[0]}`;
  
  const content = `# Data Analysis Report

Generated: ${timestamp}

## Overview

- **Total Pages**: ${insights.overview.totalPages}
- **Total Text Content**: ${(insights.overview.totalTextLength / 1024).toFixed(2)} KB
- **Total Code Samples**: ${insights.overview.totalCodeSamples}
- **Average Render Time**: ${insights.overview.averageRenderTime.toFixed(0)}ms
- **Unique Domains**: ${insights.overview.uniqueDomains}
- **Time Range**: ${insights.overview.timeRange.earliest} to ${insights.overview.timeRange.latest}

## Content Analysis

### Most Common Headings
${insights.contentAnalysis.mostCommonHeadings
  .map(({ text, count }) => `- "${text}" (${count} times)`)
  .join('\n')}

### Programming Languages
${insights.contentAnalysis.languageDistribution
  .map(({ language, count }) => `- ${language}: ${count} samples`)
  .join('\n')}

- **Average Content Length**: ${insights.contentAnalysis.averageContentLength.toFixed(0)} characters
- **Pages with Errors**: ${insights.contentAnalysis.pagesWithErrors}

## Technical Metrics

### Render Time Distribution
- **Fast (< 2s)**: ${insights.technicalMetrics.renderTimeDistribution.fast} pages
- **Medium (2-5s)**: ${insights.technicalMetrics.renderTimeDistribution.medium} pages
- **Slow (> 5s)**: ${insights.technicalMetrics.renderTimeDistribution.slow} pages

### Code Complexity
- **Average Code Length**: ${insights.technicalMetrics.codeComplexity.averageCodeLength.toFixed(0)} characters
- **Longest Code Sample**: ${insights.technicalMetrics.codeComplexity.maxCodeLength} characters
- **Shortest Code Sample**: ${insights.technicalMetrics.codeComplexity.minCodeLength} characters

## Recommendations

${insights.recommendations.map(rec => `- ${rec}`).join('\n')}

---
*Report generated by Design System Analyzer*
`;

  return {
    filename: `${exportFilename}.md`,
    content,
    mimeType: 'text/markdown',
    size: new Blob([content]).size
  };
}
