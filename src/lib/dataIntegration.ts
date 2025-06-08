/**
 * Data Integration Utilities
 * 
 * Provides utility functions to bridge the gap between different data formats
 * and integrate crawling results with the data management system.
 */

import { ExtractedPageContent, Component, ContentChunk, SemanticContent, CodeSample, ComponentProp } from '../types/types';
import { saveToLocalStorage, loadFromLocalStorage } from './export';
import { sanitizePageContent, generateDataInsights } from './dataUtils';

// ==================== DATA CONVERSION UTILITIES ====================

/**
 * Convert ContentChunks (legacy format) to ExtractedPageContent (new format)
 */
export function convertChunksToPages(chunks: ContentChunk[], sourceUrl: string): ExtractedPageContent[] {
  return chunks.map((chunk, index) => {
    const extractedPage: ExtractedPageContent = {
      id: chunk.id || `converted-${Date.now()}-${index}`,
      url: (chunk.metadata?.sourceUrl as string) || sourceUrl || '',
      textContent: extractTextFromChunk(chunk),
      semanticContent: extractSemanticContentFromChunk(chunk),
      metadata: {
        title: extractTitleFromChunk(chunk),
        description: '',
        language: 'en'
      },
      codeSamples: extractCodeSamplesFromChunk(chunk),
      timestamp: new Date().toISOString(),
      errors: []
    };

    return sanitizePageContent(extractedPage);
  });
}

/**
 * Convert ExtractedPageContent to Components for the component viewer
 */
export function convertPagesToComponents(pages: ExtractedPageContent[]): Component[] {
  const components: Component[] = [];
  
  pages.forEach(page => {
    // Try to extract component information from each page
    const componentMatches = extractComponentsFromPage(page);
    components.push(...componentMatches);
  });

  return components;
}

/**
 * Extract component information from a page
 */
function extractComponentsFromPage(page: ExtractedPageContent): Component[] {
  const components: Component[] = [];
  
  // Look for component patterns in headings and code samples
  page.semanticContent.headings.forEach(heading => {
    if (isComponentHeading(heading.text)) {
      const component: Component = {
        id: `component-${page.id}-${heading.text.toLowerCase().replace(/\s+/g, '-')}`,
        sourceId: page.url,
        name: heading.text,
        description: findDescriptionForHeading(page, heading.text),
        props: extractPropsFromPage(page),
        codeSnippets: extractExamplesFromPage(page, heading.text).map(code => ({ code, description: `Example for ${heading.text}` })),
        relationships: [],
        metadata: { sourceUrl: page.url }
      };
      
      components.push(component);
    }
  });

  // Also check for components in code samples
  page.codeSamples.forEach(sample => {
    if (isComponentCode(sample.code)) {
      const componentName = extractComponentNameFromCode(sample.code);
      if (componentName) {
        const component: Component = {
          id: `component-code-${page.id}-${componentName.toLowerCase().replace(/\s+/g, '-')}`,
          sourceId: page.url,
          name: componentName,
          description: sample.context || '',
          props: extractPropsFromCode(sample.code),
          codeSnippets: [{ code: sample.code, description: `Example for ${componentName}` }],
          relationships: [],
          metadata: { sourceUrl: page.url }
        };
        
        components.push(component);
      }
    }
  });

  return components;
}

// ==================== AUTO-SAVE UTILITIES ====================

/**
 * Auto-save utility that saves extracted pages with metadata
 */
export class AutoSaveManager {
  private autoSaveKey = 'auto-save-extracted-pages';
  private lastSaveTime = 0;
  private saveInterval = 30000; // 30 seconds

  /**
   * Save pages if enough time has passed since last save
   */
  autoSave(pages: ExtractedPageContent[]): void {
    const now = Date.now();
    if (now - this.lastSaveTime > this.saveInterval) {
      this.saveWithMetadata(pages);
      this.lastSaveTime = now;
    }
  }

  /**
   * Save pages with additional metadata
   */
  saveWithMetadata(pages: ExtractedPageContent[]): boolean {
    const saveData = {
      pages,
      metadata: {
        version: '1.0',
        savedAt: new Date().toISOString(),
        totalPages: pages.length,
        totalCodeSamples: pages.reduce((sum, page) => sum + page.codeSamples.length, 0),
        insights: generateDataInsights(pages)
      }
    };

    try {
      localStorage.setItem(this.autoSaveKey, JSON.stringify(saveData));
      return true;
    } catch {
      console.error('Auto-save failed');
      return false;
    }
  }

  /**
   * Load auto-saved pages
   */
  loadAutoSaved(): ExtractedPageContent[] | null {
    try {
      const saved = localStorage.getItem(this.autoSaveKey);
      if (!saved) return null;

      const saveData = JSON.parse(saved);
      return saveData.pages || null;
    } catch {
      console.error('Failed to load auto-saved data');
      return null;
    }
  }

  /**
   * Clear auto-saved data
   */
  clearAutoSaved(): void {
    localStorage.removeItem(this.autoSaveKey);
  }

  /**
   * Get auto-save metadata
   */
  getAutoSaveMetadata(): Record<string, unknown> | null {
    try {
      const saved = localStorage.getItem(this.autoSaveKey);
      if (!saved) return null;

      const saveData = JSON.parse(saved);
      return saveData.metadata || null;
    } catch {
      return null;
    }
  }
}

// ==================== BULK OPERATIONS ====================

/**
 * Bulk operations for managing multiple datasets
 */
export class BulkDataManager {
  /**
   * Merge pages from multiple sources, removing duplicates
   */
  mergeMultipleSources(
    sourcePages: Array<{ sourceName: string; pages: ExtractedPageContent[] }>
  ): ExtractedPageContent[] {
    const urlMap = new Map<string, ExtractedPageContent>();
    
    sourcePages.forEach(({ sourceName, pages }) => {
      pages.forEach(page => {
        const existingPage = urlMap.get(page.url);
        
        if (!existingPage) {
          // Add source information to metadata
          const enhancedPage = {
            ...page,
            metadata: {
              ...page.metadata,
              sourceName,
              mergedAt: new Date().toISOString()
            }
          };
          urlMap.set(page.url, enhancedPage);
        } else {
          // Keep the page with more content
          const existingContentLength = existingPage.textContent.length + existingPage.codeSamples.length;
          const newContentLength = page.textContent.length + page.codeSamples.length;
          
          if (newContentLength > existingContentLength) {
            const enhancedPage = {
              ...page,
              metadata: {
                ...page.metadata,
                sourceName,
                mergedAt: new Date().toISOString(),
                replacedDuplicate: true
              }
            };
            urlMap.set(page.url, enhancedPage);
          }
        }
      });
    });

    return Array.from(urlMap.values());
  }

  /**
   * Create backup of current data state
   */
  createBackup(pages: ExtractedPageContent[]): string {
    const backupKey = `backup-${Date.now()}`;
    const success = saveToLocalStorage(backupKey, pages);
    
    if (success) {
      // Keep track of backups
      const backupList = this.getBackupList();
      backupList.push({
        key: backupKey,
        timestamp: new Date().toISOString(),
        pageCount: pages.length
      });
      
      // Keep only last 10 backups
      if (backupList.length > 10) {
        const oldBackup = backupList.shift();
        if (oldBackup) {
          localStorage.removeItem(oldBackup.key);
        }
      }
      
      localStorage.setItem('backup-list', JSON.stringify(backupList));
      return backupKey;
    }
    
    throw new Error('Failed to create backup');
  }

  /**
   * Restore from backup
   */
  restoreFromBackup(backupKey: string): ExtractedPageContent[] | null {
    return loadFromLocalStorage(backupKey);
  }

  /**
   * Get list of available backups
   */
  getBackupList(): Array<{ key: string; timestamp: string; pageCount: number }> {
    try {
      const backupList = localStorage.getItem('backup-list');
      return backupList ? JSON.parse(backupList) : [];
    } catch {
      return [];
    }
  }
}

// ==================== HELPER FUNCTIONS ====================

function extractTextFromChunk(chunk: ContentChunk): string {
  if (chunk.type === 'html') {
    return chunk.content;
  } else {
    // Strip HTML tags to get text content for other types
    return chunk.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

function extractSemanticContentFromChunk(chunk: ContentChunk): SemanticContent {
  // Basic semantic content extraction from HTML chunks
  const semanticContent: SemanticContent = {
    headings: [],
    paragraphs: [],
    lists: [],
    altTexts: [],
    ariaLabels: [],
    landmarks: []
  };

  if (chunk.type === 'html') {
    // Simple regex-based extraction
    const headingMatches = chunk.content.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi);
    if (headingMatches) {
      semanticContent.headings = headingMatches.map(match => {
        const level = parseInt(match.match(/<h([1-6])/)?.[1] || '1');
        const text = match.replace(/<[^>]*>/g, '').trim();
        return { level, text };
      });
    }

    const paragraphMatches = chunk.content.match(/<p[^>]*>(.*?)<\/p>/gi);
    if (paragraphMatches) {
      semanticContent.paragraphs = paragraphMatches.map(match => 
        match.replace(/<[^>]*>/g, '').trim()
      ).filter(text => text.length > 0);
    }
  }

  return semanticContent;
}

function extractTitleFromChunk(chunk: ContentChunk): string {
  if (chunk.type === 'html') {
    const titleMatch = chunk.content.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (titleMatch) {
      return titleMatch[1].replace(/<[^>]*>/g, '').trim();
    }
  }
  return '';
}

function extractCodeSamplesFromChunk(chunk: ContentChunk): CodeSample[] {
  const codeSamples: CodeSample[] = [];
  
  if (chunk.type === 'html') {
    // Look for code blocks
    const codeMatches = chunk.content.match(/<(?:pre|code)[^>]*>(.*?)<\/(?:pre|code)>/gi);
    if (codeMatches) {
      codeMatches.forEach((match, index) => {
        const code = match.replace(/<[^>]*>/g, '').trim();
        if (code.length > 0) {
          codeSamples.push({
            id: `code-${Date.now()}-${index}`,
            code,
            language: detectLanguageFromCode(code),
            context: ''
          });
        }
      });
    }
  }

  return codeSamples;
}

function detectLanguageFromCode(code: string): string | undefined {
  // Simple language detection based on patterns
  if (code.includes('import React') || code.includes('export default')) return 'typescript';
  if (code.includes('function') && code.includes('=>')) return 'javascript';
  if (code.includes('<template>') || code.includes('<script>')) return 'vue';
  if (code.includes('class=') || code.includes('<div')) return 'html';
  if (code.includes('{') && code.includes(';')) return 'css';
  return undefined;
}

function isComponentHeading(text: string): boolean {
  const componentWords = ['button', 'input', 'modal', 'card', 'form', 'header', 'footer', 'nav', 'component'];
  const lowercaseText = text.toLowerCase();
  return componentWords.some(word => lowercaseText.includes(word));
}

function findDescriptionForHeading(page: ExtractedPageContent, heading: string): string {
  // Look for paragraphs that follow the heading
  const headingIndex = page.semanticContent.headings.findIndex(h => h.text === heading);
  if (headingIndex >= 0 && headingIndex < page.semanticContent.paragraphs.length) {
    return page.semanticContent.paragraphs[headingIndex] || '';
  }
  return '';
}

function extractPropsFromPage(page: ExtractedPageContent): ComponentProp[] {
  // Look for prop definitions in the text content
  const props: ComponentProp[] = [];
  
  // Simple pattern matching for props
  const propPatterns = [
    /(\w+):\s*(string|number|boolean|object)/gi,
    /(\w+)\s*\|\s*(string|number|boolean)/gi
  ];

  propPatterns.forEach(pattern => {
    const matches = page.textContent.matchAll(pattern);
    for (const match of matches) {
      props.push({
        name: match[1],
        type: match[2],
        required: false,
        description: ''
      });
    }
  });

  return props;
}

function extractExamplesFromPage(page: ExtractedPageContent, componentName: string): string[] {
  return page.codeSamples
    .filter(sample => sample.code.toLowerCase().includes(componentName.toLowerCase()))
    .map(sample => sample.code);
}

function isComponentCode(code: string): boolean {
  // Check if code looks like a component definition
  return code.includes('export') && (
    code.includes('function') || 
    code.includes('const') || 
    code.includes('class')
  );
}

function extractComponentNameFromCode(code: string): string | null {
  // Try to extract component name from various patterns
  const patterns = [
    /export\s+(?:default\s+)?(?:function\s+)?(\w+)/,
    /const\s+(\w+)\s*=.*?=>/,
    /class\s+(\w+)/
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

function extractPropsFromCode(code: string): ComponentProp[] {
  const props: ComponentProp[] = [];
  
  // Look for interface or type definitions
  const interfaceMatch = code.match(/interface\s+\w+Props\s*{([^}]+)}/);
  if (interfaceMatch) {
    const propsText = interfaceMatch[1];
    const propMatches = propsText.matchAll(/(\w+)(\?)?\s*:\s*([^;,\n]+)/g);
    
    for (const match of propMatches) {
      props.push({
        name: match[1],
        type: match[3].trim(),
        required: !match[2], // No ? means required
        description: ''
      });
    }
  }

  return props;
}

// Export singleton instances
export const autoSaveManager = new AutoSaveManager();
export const bulkDataManager = new BulkDataManager();
