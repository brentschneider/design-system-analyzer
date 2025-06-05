import puppeteer, { Page } from 'puppeteer';
import { JSDOM } from 'jsdom';
import { CrawlProgress, ContentChunk } from '../types/types';

const RATE_LIMIT_MS = 1000; // 1 second between requests
const MAX_RETRIES = 3;

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch (e) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function crawlDesignSystem(
  url: string,
  onProgress: (progress: CrawlProgress) => void,
  signal?: AbortSignal
): Promise<ContentChunk[]> {
  const normalizedUrl = normalizeUrl(url);
const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});
  const page = await browser.newPage();
  const chunks: ContentChunk[] = [];
  
  // Set a reasonable timeout
  page.setDefaultTimeout(30000);
  
  try {
    // Start with the main documentation page
    let retries = 0;
    let success = false;
    
    while (!success && retries < MAX_RETRIES) {
      try {
        await page.goto(normalizedUrl, { 
          waitUntil: 'networkidle0',
          timeout: 30000 
        });
        success = true;
      } catch (error) {
        retries++;
        if (retries === MAX_RETRIES) {
          throw new Error(`Failed to load page after ${MAX_RETRIES} attempts: ${error.message}`);
        }
        await wait(RATE_LIMIT_MS);
      }
    }
    
    // Find all documentation pages with proper error handling
    const links = await page.evaluate(() => {
      try {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.getAttribute('href'))
          .filter((href): href is string => !!href && (
            href.includes('/docs/') || 
            href.includes('/components/') ||
            href.includes('/design-system/') ||
            href.includes('/ui/') ||
            href.includes('/patterns/')
          ))
          .map(href => new URL(href, window.location.href).toString());
      } catch (error) {
        console.error('Error collecting links:', error);
        return [];
      }
    });
    
    const uniqueLinks = [...new Set(links)].filter((l): l is string => typeof l === 'string');
    
    // Process each page with retries and rate limiting
    for (let i = 0; i < uniqueLinks.length && !signal?.aborted; i++) {
      const currentUrl: string = uniqueLinks[i];
      
      onProgress({
        sourceId: url,
        pagesProcessed: i + 1,
        totalPages: links.length,
        componentsFound: chunks.length,
        currentPage: currentUrl
      });
      
      let pageContent: ExtractedContent[] = [];
      let retries = 0;
      let pageSuccess = false;
      
      while (!pageSuccess && retries < MAX_RETRIES && !signal?.aborted) {
        try {
          await page.goto(currentUrl, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
          });
          
          // Wait for content to load
          await page.waitForSelector('main, article, [class*="component"]', {
            timeout: 5000
          }).catch(() => {}); // Ignore timeout, some pages might not have these elements
          
          pageContent = await extractContent(page);
          pageSuccess = true;
        } catch (error) {
          console.error(`Error processing ${currentUrl}:`, error);
          retries++;
          if (retries === MAX_RETRIES) {
            console.error(`Failed to process ${currentUrl} after ${MAX_RETRIES} attempts`);
            continue; // Skip this page and move to the next
          }
          await wait(RATE_LIMIT_MS);
        }
      }
      
      chunks.push(...pageContent.map(chunk => ({
        id: `chunk-${Date.now()}-${Math.random()}`,
        content: chunk.content,
        metadata: {
          sourceUrl: currentUrl,
          section: chunk.section,
          componentId: chunk.componentId
        }
      })));
      
      // Rate limiting between pages
      await wait(RATE_LIMIT_MS);
    }
  } catch (error) {
    console.error('Crawling error:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  return chunks;
}

interface ExtractedContent {
  content: string;
  section: string;
  componentId?: string;
}

async function extractContent(page: Page): Promise<ExtractedContent[]> {
return await page.evaluate(() => {
    const sections: ExtractedContent[] = [];
    
    try {
      // Extract main content
      const mainContent = document.querySelector('main');
      if (mainContent) {
        sections.push({
          content: mainContent.textContent || '',
          section: 'main'
        });
      }
      
      // Extract component-specific content with improved selectors
      const componentSelectors = [
        '[class*="component"]',
        '[id*="component"]',
        '.docs-component',
        '.component-preview',
        '[data-component]',
        'article'
      ];
      
      const componentSections = document.querySelectorAll(componentSelectors.join(','));
      componentSections.forEach((section, index) => {
        const content = section.textContent || '';
        if (content.trim()) {
          sections.push({
            content,
            section: `component-${index}`,
            componentId: section.id || undefined
          });
        }
      });
      
      // Look for markdown or documentation sections
      const docSections = document.querySelectorAll('.markdown, .documentation, .docs-content');
      docSections.forEach((section, index) => {
        const content = section.textContent || '';
        if (content.trim()) {
          sections.push({
            content,
            section: `docs-${index}`,
            componentId: section.getAttribute('data-component-id') || undefined
          });
        }
      });
    } catch (error) {
      console.error('Error extracting content:', error);
    }
    
    return sections;
  });
}

export function cleanAndChunkContent(content: string): string[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .reduce((chunks: string[], line) => {
      const lastChunk = chunks[chunks.length - 1];
      if (!lastChunk || lastChunk.length + line.length > 1000) {
        chunks.push(line);
      } else {
        chunks[chunks.length - 1] = `${lastChunk} ${line}`;
      }
      return chunks;
    }, []);
}

interface ExtractedComponentInfo {
  type: string;
  props: string[];
  description: string;
  examples: string[];
}

export function extractComponentInfo(html: string): ExtractedComponentInfo {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  
  // Try to find component type/name from various possible locations
  const type = document.querySelector('h1, h2, [class*="title"], [class*="heading"]')?.textContent?.trim() || '';
  
  // Look for prop definitions in tables and definition lists
  const props: string[] = [];
  
  // Check tables
  const tables = document.querySelectorAll('table');
  tables.forEach(table => {
    const headers = Array.from(table.querySelectorAll('th') as NodeListOf<Element>).map(th => th.textContent?.toLowerCase() || '');
    if (headers.some(h => h.includes('prop') || h.includes('parameter'))) {
      Array.from(table.querySelectorAll('tr') as NodeListOf<Element>).forEach(row => {
        const cells = Array.from(row.querySelectorAll('td') as NodeListOf<Element>).map(td => td.textContent?.trim() || '');
        if (cells.length > 0) {
          props.push(cells.join(' | '));
        }
      });
    }
  });
  
  // Check definition lists
  const dls = document.querySelectorAll('dl');
  dls.forEach(dl => {
    const terms = Array.from(dl.querySelectorAll('dt'));
    const descriptions = Array.from(dl.querySelectorAll('dd'));
    terms.forEach((term, index) => {
      const desc = descriptions[index];
      if (term && desc) {
        props.push(`${term.textContent?.trim()} | ${desc.textContent?.trim()}`);
      }
    });
  });
  
  // Get component description from various possible locations
  let description = '';
  const descriptionElements = document.querySelectorAll('p, [class*="description"], [class*="intro"]');
  for (const el of descriptionElements) {
    const text = el.textContent?.trim() || '';
    if (text.length > description.length && !text.includes('import') && !text.includes('require')) {
      description = text;
    }
  }
  
  // Extract code examples
  const examples = Array.from(document.querySelectorAll('pre code, [class*="example"] code, [class*="preview"] code'))
    .map(code => code.textContent?.trim() || '')
    .filter(code => code.length > 0);
  
  return { type, props, description, examples };
}
