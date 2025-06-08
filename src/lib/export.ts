import { ExtractedPageContent } from '../types/types';

export interface ExportOptions {
  format: 'json' | 'csv' | 'markdown' | 'html';
  includeCodeSamples?: boolean;
  includeMetadata?: boolean;
  includeSemanticContent?: boolean;
  minifyJson?: boolean;
  separateCodeFiles?: boolean;
  filename?: string;
}

export interface ExportResult {
  filename: string;
  content: string;
  mimeType: string;
  size: number;
  additionalFiles?: Array<{
    filename: string;
    content: string;
    mimeType: string;
  }>;
}

/**
 * Export extracted page content to various formats
 */
export function exportPages(
  pages: ExtractedPageContent[],
  options: ExportOptions = { format: 'json' }
): ExportResult {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseFilename = options.filename || `crawl-export-${timestamp}`;

  switch (options.format) {
    case 'json':
      return exportToJson(pages, options, baseFilename);
    case 'csv':
      return exportToCsv(pages, options, baseFilename);
    case 'markdown':
      return exportToMarkdown(pages, options, baseFilename);
    case 'html':
      return exportToHtml(pages, options, baseFilename);
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

/**
 * Export to JSON format with optional filtering
 */
function exportToJson(
  pages: ExtractedPageContent[],
  options: ExportOptions,
  baseFilename: string
): ExportResult {
  const filteredPages = pages.map(page => {
    const filtered: Partial<ExtractedPageContent> = {
      id: page.id,
      url: page.url,
      textContent: page.textContent,
      timestamp: page.timestamp,
      renderTime: page.renderTime,
      errors: page.errors
    };

    if (options.includeSemanticContent !== false) {
      filtered.semanticContent = page.semanticContent;
    }

    if (options.includeMetadata !== false) {
      filtered.metadata = page.metadata;
    }

    if (options.includeCodeSamples !== false) {
      filtered.codeSamples = page.codeSamples;
    }

    return filtered;
  });

  const exportData = {
    exportInfo: {
      timestamp: new Date().toISOString(),
      totalPages: pages.length,
      totalCodeSamples: pages.reduce((sum, page) => sum + page.codeSamples.length, 0),
      options
    },
    pages: filteredPages
  };

  const content = options.minifyJson 
    ? JSON.stringify(exportData)
    : JSON.stringify(exportData, null, 2);

  const result: ExportResult = {
    filename: `${baseFilename}.json`,
    content,
    mimeType: 'application/json',
    size: new Blob([content]).size
  };

  // Optionally create separate files for code samples
  if (options.separateCodeFiles && options.includeCodeSamples !== false) {
    result.additionalFiles = createSeparateCodeFiles(pages);
  }

  return result;
}

/**
 * Export to CSV format
 */
function exportToCsv(
  pages: ExtractedPageContent[],
  options: ExportOptions,
  baseFilename: string
): ExportResult {
  const headers = [
    'id',
    'url',
    'title',
    'description',
    'textLength',
    'headingsCount',
    'paragraphsCount',
    'codeSamplesCount',
    'renderTime',
    'timestamp',
    'errors'
  ];

  if (options.includeMetadata !== false) {
    headers.push('language', 'canonicalUrl', 'openGraphTitle');
  }

  const rows = pages.map(page => {
    const row = [
      escapeCSV(page.id),
      escapeCSV(page.url),
      escapeCSV(page.metadata.title || ''),
      escapeCSV(page.metadata.description || ''),
      page.textContent.length.toString(),
      page.semanticContent.headings.length.toString(),
      page.semanticContent.paragraphs.length.toString(),
      page.codeSamples.length.toString(),
      (page.renderTime || 0).toString(),
      page.timestamp,
      escapeCSV((page.errors || []).join('; '))
    ];

    if (options.includeMetadata !== false) {
      row.push(
        escapeCSV(page.metadata.language || ''),
        escapeCSV(page.metadata.canonicalUrl || ''),
        escapeCSV(page.metadata.openGraph?.title || '')
      );
    }

    return row;
  });

  const content = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

  return {
    filename: `${baseFilename}.csv`,
    content,
    mimeType: 'text/csv',
    size: new Blob([content]).size
  };
}

/**
 * Export to Markdown format
 */
function exportToMarkdown(
  pages: ExtractedPageContent[],
  options: ExportOptions,
  baseFilename: string
): ExportResult {
  const lines: string[] = [];

  // Header
  lines.push('# Crawl Export Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Total Pages:** ${pages.length}`);
  lines.push(`**Total Code Samples:** ${pages.reduce((sum, page) => sum + page.codeSamples.length, 0)}`);
  lines.push('');

  // Table of Contents
  lines.push('## Table of Contents');
  lines.push('');
  pages.forEach((page, index) => {
    const title = page.metadata.title || page.url;
    lines.push(`${index + 1}. [${title}](#page-${index + 1})`);
  });
  lines.push('');

  // Pages
  pages.forEach((page, index) => {
    lines.push(`## Page ${index + 1}`);
    lines.push('');
    lines.push(`**URL:** ${page.url}`);
    lines.push(`**Title:** ${page.metadata.title || 'Untitled'}`);
    
    if (page.metadata.description) {
      lines.push(`**Description:** ${page.metadata.description}`);
    }
    
    lines.push(`**Render Time:** ${page.renderTime || 0}ms`);
    lines.push('');

    // Semantic content
    if (options.includeSemanticContent !== false && page.semanticContent.headings.length > 0) {
      lines.push('### Headings');
      lines.push('');
      page.semanticContent.headings.forEach(heading => {
        const prefix = '#'.repeat(heading.level + 2);
        lines.push(`${prefix} ${heading.text}`);
      });
      lines.push('');
    }

    // Code samples
    if (options.includeCodeSamples !== false && page.codeSamples.length > 0) {
      lines.push('### Code Samples');
      lines.push('');
      page.codeSamples.forEach((sample, sampleIndex) => {
        const language = sample.language || sample.detectedLanguage || '';
        lines.push(`#### Sample ${sampleIndex + 1}`);
        if (sample.context) {
          lines.push(`**Context:** ${sample.context}`);
        }
        if (language) {
          lines.push(`**Language:** ${language}`);
        }
        lines.push('');
        lines.push(`\`\`\`${language}`);
        lines.push(sample.code);
        lines.push('```');
        lines.push('');
      });
    }

    // Metadata
    if (options.includeMetadata !== false) {
      lines.push('### Metadata');
      lines.push('');
      if (page.metadata.keywords?.length) {
        lines.push(`**Keywords:** ${page.metadata.keywords.join(', ')}`);
      }
      if (page.metadata.language) {
        lines.push(`**Language:** ${page.metadata.language}`);
      }
      if (page.metadata.openGraph) {
        lines.push(`**Open Graph Title:** ${page.metadata.openGraph.title || 'N/A'}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  });

  const content = lines.join('\n');

  return {
    filename: `${baseFilename}.md`,
    content,
    mimeType: 'text/markdown',
    size: new Blob([content]).size
  };
}

/**
 * Export to HTML format
 */
function exportToHtml(
  pages: ExtractedPageContent[],
  options: ExportOptions,
  baseFilename: string
): ExportResult {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crawl Export Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; margin: 40px; line-height: 1.6; }
    .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
    .page { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
    .page-title { color: #333; margin-top: 0; }
    .metadata { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
    .code-sample { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 6px; padding: 16px; margin: 10px 0; }
    .code-sample pre { margin: 0; overflow-x: auto; }
    .toc { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .toc ul { list-style-type: none; padding-left: 0; }
    .toc li { margin: 8px 0; }
    .toc a { text-decoration: none; color: #0366d6; }
    .toc a:hover { text-decoration: underline; }
    .stats { display: flex; gap: 30px; margin: 20px 0; }
    .stat { text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; color: #0366d6; }
    .stat-label { font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Crawl Export Report</h1>
    <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${pages.length}</div>
        <div class="stat-label">Pages</div>
      </div>
      <div class="stat">
        <div class="stat-value">${pages.reduce((sum, page) => sum + page.codeSamples.length, 0)}</div>
        <div class="stat-label">Code Samples</div>
      </div>
      <div class="stat">
        <div class="stat-value">${Math.round(pages.reduce((sum, page) => sum + (page.renderTime || 0), 0))}ms</div>
        <div class="stat-label">Total Render Time</div>
      </div>
    </div>
  </div>

  <div class="toc">
    <h2>Table of Contents</h2>
    <ul>
      ${pages.map((page, index) => {
        const title = escapeHtml(page.metadata.title || page.url);
        return `<li><a href="#page-${index}">${index + 1}. ${title}</a></li>`;
      }).join('\n      ')}
    </ul>
  </div>

  ${pages.map((page, index) => `
  <div class="page" id="page-${index}">
    <h2 class="page-title">${escapeHtml(page.metadata.title || 'Untitled')}</h2>
    <p><strong>URL:</strong> <a href="${page.url}" target="_blank">${escapeHtml(page.url)}</a></p>
    ${page.metadata.description ? `<p><strong>Description:</strong> ${escapeHtml(page.metadata.description)}</p>` : ''}
    <p><strong>Render Time:</strong> ${page.renderTime || 0}ms</p>

    ${options.includeSemanticContent !== false && page.semanticContent.headings.length > 0 ? `
    <h3>Headings</h3>
    <ul>
      ${page.semanticContent.headings.map(heading => 
        `<li>H${heading.level}: ${escapeHtml(heading.text)}</li>`
      ).join('\n      ')}
    </ul>
    ` : ''}

    ${options.includeCodeSamples !== false && page.codeSamples.length > 0 ? `
    <h3>Code Samples</h3>
    ${page.codeSamples.map((sample, sampleIndex) => `
    <div class="code-sample">
      <h4>Sample ${sampleIndex + 1}</h4>
      ${sample.context ? `<p><strong>Context:</strong> ${escapeHtml(sample.context)}</p>` : ''}
      ${sample.language || sample.detectedLanguage ? `<p><strong>Language:</strong> ${escapeHtml(sample.language || sample.detectedLanguage || '')}</p>` : ''}
      <pre><code>${escapeHtml(sample.code)}</code></pre>
    </div>
    `).join('\n    ')}
    ` : ''}

    ${options.includeMetadata !== false ? `
    <div class="metadata">
      <h3>Metadata</h3>
      ${page.metadata.keywords?.length ? `<p><strong>Keywords:</strong> ${escapeHtml(page.metadata.keywords.join(', '))}</p>` : ''}
      ${page.metadata.language ? `<p><strong>Language:</strong> ${escapeHtml(page.metadata.language)}</p>` : ''}
      ${page.metadata.openGraph?.title ? `<p><strong>Open Graph Title:</strong> ${escapeHtml(page.metadata.openGraph.title)}</p>` : ''}
      ${page.metadata.canonicalUrl ? `<p><strong>Canonical URL:</strong> <a href="${page.metadata.canonicalUrl}" target="_blank">${escapeHtml(page.metadata.canonicalUrl)}</a></p>` : ''}
    </div>
    ` : ''}
  </div>
  `).join('\n')}
</body>
</html>`;

  return {
    filename: `${baseFilename}.html`,
    content: html,
    mimeType: 'text/html',
    size: new Blob([html]).size
  };
}

/**
 * Create separate files for code samples
 */
function createSeparateCodeFiles(pages: ExtractedPageContent[]): Array<{filename: string; content: string; mimeType: string}> {
  const files: Array<{filename: string; content: string; mimeType: string}> = [];
  
  pages.forEach((page, pageIndex) => {
    page.codeSamples.forEach((sample, sampleIndex) => {
      const extension = getFileExtension(sample.language || sample.detectedLanguage || 'txt');
      const filename = `code-page-${pageIndex + 1}-sample-${sampleIndex + 1}.${extension}`;
      
      files.push({
        filename,
        content: sample.code,
        mimeType: getMimeType(extension)
      });
    });
  });
  
  return files;
}

/**
 * Utility functions
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    jsx: 'jsx',
    tsx: 'tsx',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    xml: 'xml',
    json: 'json',
    yaml: 'yml',
    python: 'py',
    java: 'java',
    csharp: 'cs',
    php: 'php',
    ruby: 'rb',
    go: 'go',
    rust: 'rs',
    swift: 'swift',
    kotlin: 'kt',
    shell: 'sh',
    bash: 'sh',
    powershell: 'ps1',
    sql: 'sql',
    markdown: 'md'
  };
  
  return extensions[language.toLowerCase()] || 'txt';
}

function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    js: 'application/javascript',
    ts: 'application/typescript',
    jsx: 'application/javascript',
    tsx: 'application/typescript',
    css: 'text/css',
    html: 'text/html',
    json: 'application/json',
    py: 'text/x-python',
    java: 'text/x-java-source',
    cs: 'text/x-csharp',
    php: 'application/x-php',
    rb: 'application/x-ruby',
    go: 'text/x-go',
    rs: 'text/x-rust',
    swift: 'text/x-swift',
    sh: 'application/x-sh',
    sql: 'application/sql',
    md: 'text/markdown'
  };
  
  return mimeTypes[extension] || 'text/plain';
}

/**
 * Save exported data to browser download
 */
export function downloadExport(exportResult: ExportResult): void {
  // Create and trigger download for main file
  const blob = new Blob([exportResult.content], { type: exportResult.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportResult.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Download additional files if any
  if (exportResult.additionalFiles) {
    exportResult.additionalFiles.forEach(file => {
      const blob = new Blob([file.content], { type: file.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
}

/**
 * Save to local storage with compression
 */
export function saveToLocalStorage(key: string, pages: ExtractedPageContent[]): boolean {
  try {
    const compressed = compressPages(pages);
    localStorage.setItem(key, JSON.stringify(compressed));
    return true;
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    return false;
  }
}

/**
 * Load from local storage with decompression
 */
export function loadFromLocalStorage(key: string): ExtractedPageContent[] | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const compressed = JSON.parse(stored);
    return decompressPages(compressed);
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return null;
  }
}

interface CompressedPage {
  i: string; // id
  u: string; // url
  t: string; // textContent (truncated)
  s: {
    h: Array<{ level: number; text: string; id?: string }>;
    p: string[];
    l: Array<{ type: 'ul' | 'ol'; items: string[] }>;
    a: string[];
    ar: string[];
    lm: Array<{ role: string; label?: string; content?: string }>;
  };
  m: Record<string, unknown> | undefined;
  c: Array<{
    id: string;
    code: string;
    language?: string;
    context?: string;
    detectedLanguage?: string;
    confidence?: number;
  }>;
  ts: string;
  rt?: number;
  e?: string[];
}

interface CompressedData {
  version: string;
  timestamp: string;
  count: number;
  pages: CompressedPage[];
}

/**
 * Simple compression for storage
 */
function compressPages(pages: ExtractedPageContent[]): CompressedData {
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    count: pages.length,
    pages: pages.map(page => ({
      i: page.id,
      u: page.url,
      t: page.textContent.substring(0, 5000), // Limit text content
      s: {
        h: page.semanticContent.headings,
        p: page.semanticContent.paragraphs.slice(0, 10), // Limit paragraphs
        l: page.semanticContent.lists,
        a: page.semanticContent.altTexts,
        ar: page.semanticContent.ariaLabels,
        lm: page.semanticContent.landmarks
      },
      m: page.metadata as Record<string, unknown> | undefined,
      c: page.codeSamples,
      ts: page.timestamp,
      rt: page.renderTime,
      e: page.errors
    }))
  };
}

/**
 * Decompress pages from storage format
 */
function decompressPages(compressed: CompressedData): ExtractedPageContent[] {
  if (!compressed.pages) return [];
  
  return compressed.pages.map((p: CompressedPage): ExtractedPageContent => ({
    id: p.i,
    url: p.u,
    textContent: p.t,
    semanticContent: {
      headings: p.s.h || [],
      paragraphs: p.s.p || [],
      lists: p.s.l || [],
      altTexts: p.s.a || [],
      ariaLabels: p.s.ar || [],
      landmarks: p.s.lm || []
    },
    metadata: p.m || {},
    codeSamples: p.c || [],
    timestamp: p.ts,
    renderTime: p.rt,
    errors: p.e
  }));
}
