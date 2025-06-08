/**
 * Advanced Export Utilities
 * 
 * Provides additional export formats and advanced export functionality
 * for the Design System Analyzer.
 */

import { ExtractedPageContent } from '../types/types';
import { ExportResult } from './export';

/**
 * Export to XML format
 */
export function exportToXml(
  pages: ExtractedPageContent[],
  options: { includeCodeSamples?: boolean; includeMetadata?: boolean } = {}
): ExportResult {
  const { includeCodeSamples = true, includeMetadata = true } = options;
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<design-system-export>\n';
  xml += `  <export-info>\n`;
  xml += `    <timestamp>${new Date().toISOString()}</timestamp>\n`;
  xml += `    <total-pages>${pages.length}</total-pages>\n`;
  xml += `    <total-code-samples>${pages.reduce((sum, page) => sum + page.codeSamples.length, 0)}</total-code-samples>\n`;
  xml += `  </export-info>\n`;
  xml += '  <pages>\n';

  pages.forEach(page => {
    xml += '    <page>\n';
    xml += `      <id>${escapeXml(page.id)}</id>\n`;
    xml += `      <url>${escapeXml(page.url)}</url>\n`;
    xml += `      <timestamp>${page.timestamp}</timestamp>\n`;
    xml += `      <text-content>${escapeXml(page.textContent)}</text-content>\n`;
    
    if (includeMetadata && page.metadata) {
      xml += '      <metadata>\n';
      if (page.metadata.title) xml += `        <title>${escapeXml(page.metadata.title)}</title>\n`;
      if (page.metadata.description) xml += `        <description>${escapeXml(page.metadata.description)}</description>\n`;
      if (page.metadata.language) xml += `        <language>${escapeXml(page.metadata.language)}</language>\n`;
      xml += '      </metadata>\n';
    }

    xml += '      <semantic-content>\n';
    xml += '        <headings>\n';
    page.semanticContent.headings.forEach(heading => {
      xml += `          <heading level="${heading.level}">${escapeXml(heading.text)}</heading>\n`;
    });
    xml += '        </headings>\n';
    xml += '        <paragraphs>\n';
    page.semanticContent.paragraphs.forEach(paragraph => {
      xml += `          <paragraph>${escapeXml(paragraph)}</paragraph>\n`;
    });
    xml += '        </paragraphs>\n';
    xml += '      </semantic-content>\n';

    if (includeCodeSamples && page.codeSamples.length > 0) {
      xml += '      <code-samples>\n';
      page.codeSamples.forEach(sample => {
        xml += '        <code-sample>\n';
        xml += `          <id>${escapeXml(sample.id)}</id>\n`;
        if (sample.language) xml += `          <language>${escapeXml(sample.language)}</language>\n`;
        if (sample.context) xml += `          <context>${escapeXml(sample.context)}</context>\n`;
        xml += `          <code><![CDATA[${sample.code}]]></code>\n`;
        xml += '        </code-sample>\n';
      });
      xml += '      </code-samples>\n';
    }

    if (page.errors && page.errors.length > 0) {
      xml += '      <errors>\n';
      page.errors.forEach(error => {
        xml += `        <error>${escapeXml(error)}</error>\n`;
      });
      xml += '      </errors>\n';
    }

    xml += '    </page>\n';
  });

  xml += '  </pages>\n';
  xml += '</design-system-export>';

  return {
    filename: `design-system-export-${new Date().toISOString().replace(/[:.]/g, '-')}.xml`,
    content: xml,
    mimeType: 'application/xml',
    size: new Blob([xml]).size
  };
}

/**
 * Export to YAML format
 */
export function exportToYaml(
  pages: ExtractedPageContent[],
  options: { includeCodeSamples?: boolean; includeMetadata?: boolean } = {}
): ExportResult {
  const { includeCodeSamples = true, includeMetadata = true } = options;
  
  let yaml = '# Design System Export\n';
  yaml += `export_info:\n`;
  yaml += `  timestamp: "${new Date().toISOString()}"\n`;
  yaml += `  total_pages: ${pages.length}\n`;
  yaml += `  total_code_samples: ${pages.reduce((sum, page) => sum + page.codeSamples.length, 0)}\n`;
  yaml += '\npages:\n';

  pages.forEach((page) => {
    yaml += `  - id: "${page.id}"\n`;
    yaml += `    url: "${page.url}"\n`;
    yaml += `    timestamp: "${page.timestamp}"\n`;
    yaml += `    text_content: |\n`;
    yaml += `      ${page.textContent.replace(/\n/g, '\n      ')}\n`;
    
    if (includeMetadata && page.metadata) {
      yaml += `    metadata:\n`;
      if (page.metadata.title) yaml += `      title: "${escapeYaml(page.metadata.title)}"\n`;
      if (page.metadata.description) yaml += `      description: "${escapeYaml(page.metadata.description)}"\n`;
      if (page.metadata.language) yaml += `      language: "${page.metadata.language}"\n`;
    }

    yaml += `    semantic_content:\n`;
    yaml += `      headings:\n`;
    page.semanticContent.headings.forEach(heading => {
      yaml += `        - level: ${heading.level}\n`;
      yaml += `          text: "${escapeYaml(heading.text)}"\n`;
    });
    
    yaml += `      paragraphs:\n`;
    page.semanticContent.paragraphs.forEach(paragraph => {
      yaml += `        - "${escapeYaml(paragraph)}"\n`;
    });

    if (includeCodeSamples && page.codeSamples.length > 0) {
      yaml += `    code_samples:\n`;
      page.codeSamples.forEach(sample => {
        yaml += `      - id: "${sample.id}"\n`;
        if (sample.language) yaml += `        language: "${sample.language}"\n`;
        if (sample.context) yaml += `        context: "${escapeYaml(sample.context)}"\n`;
        yaml += `        code: |\n`;
        yaml += `          ${sample.code.replace(/\n/g, '\n          ')}\n`;
      });
    }

    if (page.errors && page.errors.length > 0) {
      yaml += `    errors:\n`;
      page.errors.forEach(error => {
        yaml += `      - "${escapeYaml(error)}"\n`;
      });
    }
  });

  return {
    filename: `design-system-export-${new Date().toISOString().replace(/[:.]/g, '-')}.yaml`,
    content: yaml,
    mimeType: 'application/x-yaml',
    size: new Blob([yaml]).size
  };
}

/**
 * Export components summary as JSON
 */
export function exportComponentsSummary(pages: ExtractedPageContent[]): ExportResult {
  const components = extractComponentsSummary(pages);
  
  const summary = {
    export_info: {
      timestamp: new Date().toISOString(),
      total_components: components.length,
      source_pages: pages.length
    },
    components
  };

  const content = JSON.stringify(summary, null, 2);

  return {
    filename: `components-summary-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    content,
    mimeType: 'application/json',
    size: new Blob([content]).size
  };
}

/**
 * Export code samples only
 */
export function exportCodeSamplesOnly(pages: ExtractedPageContent[]): ExportResult {
  const codeSamples = pages.flatMap(page => 
    page.codeSamples.map(sample => ({
      ...sample,
      source_url: page.url,
      source_page_id: page.id
    }))
  );

  const exportData = {
    export_info: {
      timestamp: new Date().toISOString(),
      total_code_samples: codeSamples.length,
      source_pages: pages.length
    },
    code_samples: codeSamples
  };

  const content = JSON.stringify(exportData, null, 2);

  return {
    filename: `code-samples-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    content,
    mimeType: 'application/json',
    size: new Blob([content]).size
  };
}

/**
 * Export as SQL INSERT statements
 */
export function exportToSql(pages: ExtractedPageContent[]): ExportResult {
  let sql = '-- Design System Export SQL\n';
  sql += `-- Generated on ${new Date().toISOString()}\n\n`;
  
  sql += 'CREATE TABLE IF NOT EXISTS pages (\n';
  sql += '  id VARCHAR(255) PRIMARY KEY,\n';
  sql += '  url TEXT NOT NULL,\n';
  sql += '  title TEXT,\n';
  sql += '  description TEXT,\n';
  sql += '  text_content TEXT,\n';
  sql += '  timestamp DATETIME,\n';
  sql += '  render_time INTEGER\n';
  sql += ');\n\n';

  sql += 'CREATE TABLE IF NOT EXISTS code_samples (\n';
  sql += '  id VARCHAR(255) PRIMARY KEY,\n';
  sql += '  page_id VARCHAR(255),\n';
  sql += '  language VARCHAR(50),\n';
  sql += '  code TEXT,\n';
  sql += '  context TEXT,\n';
  sql += '  FOREIGN KEY (page_id) REFERENCES pages(id)\n';
  sql += ');\n\n';

  sql += 'CREATE TABLE IF NOT EXISTS headings (\n';
  sql += '  id INTEGER AUTO_INCREMENT PRIMARY KEY,\n';
  sql += '  page_id VARCHAR(255),\n';
  sql += '  level INTEGER,\n';
  sql += '  text TEXT,\n';
  sql += '  FOREIGN KEY (page_id) REFERENCES pages(id)\n';
  sql += ');\n\n';

  // Insert pages
  pages.forEach(page => {
    sql += `INSERT INTO pages (id, url, title, description, text_content, timestamp, render_time) VALUES (\n`;
    sql += `  ${escapeSql(page.id)},\n`;
    sql += `  ${escapeSql(page.url)},\n`;
    sql += `  ${escapeSql(page.metadata.title || '')},\n`;
    sql += `  ${escapeSql(page.metadata.description || '')},\n`;
    sql += `  ${escapeSql(page.textContent)},\n`;
    sql += `  '${page.timestamp}',\n`;
    sql += `  ${page.renderTime || 0}\n`;
    sql += ');\n\n';

    // Insert code samples
    page.codeSamples.forEach(sample => {
      sql += `INSERT INTO code_samples (id, page_id, language, code, context) VALUES (\n`;
      sql += `  ${escapeSql(sample.id)},\n`;
      sql += `  ${escapeSql(page.id)},\n`;
      sql += `  ${escapeSql(sample.language || '')},\n`;
      sql += `  ${escapeSql(sample.code)},\n`;
      sql += `  ${escapeSql(sample.context || '')}\n`;
      sql += ');\n\n';
    });

    // Insert headings
    page.semanticContent.headings.forEach(heading => {
      sql += `INSERT INTO headings (page_id, level, text) VALUES (\n`;
      sql += `  ${escapeSql(page.id)},\n`;
      sql += `  ${heading.level},\n`;
      sql += `  ${escapeSql(heading.text)}\n`;
      sql += ');\n\n';
    });
  });

  return {
    filename: `design-system-export-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`,
    content: sql,
    mimeType: 'application/sql',
    size: new Blob([sql]).size
  };
}

// Helper functions
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeYaml(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function escapeSql(text: string): string {
  return `'${text.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

interface ComponentSummary {
  name: string;
  level: number;
  source_url: string;
  source_page_id: string;
  code_samples_count: number;
  discovered_at: string;
}

function extractComponentsSummary(pages: ExtractedPageContent[]): ComponentSummary[] {
  const components: ComponentSummary[] = [];
  
  pages.forEach(page => {
    page.semanticContent.headings.forEach(heading => {
      if (heading.text.toLowerCase().includes('component') || 
          heading.text.toLowerCase().includes('button') ||
          heading.text.toLowerCase().includes('input') ||
          heading.text.toLowerCase().includes('modal')) {
        
        components.push({
          name: heading.text,
          level: heading.level,
          source_url: page.url,
          source_page_id: page.id,
          code_samples_count: page.codeSamples.length,
          discovered_at: page.timestamp
        });
      }
    });
  });
  
  return components;
}
