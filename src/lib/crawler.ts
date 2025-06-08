import puppeteer, { Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import hljs from 'highlight.js';
import { 
  CrawlProgress, 
  ContentChunk, 
  ExtractedPageContent, 
  PageMetadata, 
  SemanticContent, 
  CodeSample 
} from '../types/types';

const RATE_LIMIT_MS = 1000; // 1 second between requests
const MAX_RETRIES = 3;
const MAX_PAGES = 50; // Limit to prevent infinite crawling

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enhanced web crawler that renders pages in headless browser and extracts
 * semantic content, metadata, and code samples in a unified format
 */
export async function crawlDesignSystem(
  url: string,
  onProgress: (progress: CrawlProgress) => void,
  signal?: AbortSignal
): Promise<ExtractedPageContent[]> {
  const normalizedUrl = normalizeUrl(url);
  console.log('🚀 Starting crawl of:', normalizedUrl);
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  try {
    console.log('📊 Browser launched successfully');
    const pages: ExtractedPageContent[] = [];
    const visitedUrls = new Set<string>();
    const queue = [normalizedUrl];
    let pageCount = 0;

    while (queue.length > 0 && pageCount < MAX_PAGES) {
      if (signal?.aborted) {
        console.log('❌ Crawl aborted');
        break;
      }

      const currentUrl = queue.shift()!;
      if (visitedUrls.has(currentUrl)) continue;
      visitedUrls.add(currentUrl);

      console.log(`\n🔍 Processing page ${pageCount + 1}:`, currentUrl);
      
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        
        // Set longer timeout and enable JS
        await page.setDefaultNavigationTimeout(30000);
        await page.setJavaScriptEnabled(true);

        console.log('  ⏳ Loading page...');
        await page.goto(currentUrl, { waitUntil: 'networkidle0' });
        console.log('  ✅ Page loaded');

        // Wait for dynamic content
        await wait(2000);

        const extractedPage = await extractPageContent(page, currentUrl);
        console.log(`  📦 Extracted content:
          - ${extractedPage.semanticContent.headings.length} headings
          - ${extractedPage.codeSamples.length} code samples
          - ${extractedPage.semanticContent.paragraphs.length} paragraphs`);

        pages.push(extractedPage);
        pageCount++;

        onProgress({
          sourceId: url,
          pagesProcessed: pageCount,
          totalPages: Math.min(queue.length + pageCount, MAX_PAGES),
          currentPage: currentUrl
        });

        // Get more URLs from the page
        const newUrls = await extractUrls(page, normalizedUrl);
        console.log(`  🔗 Found ${newUrls.length} new URLs`);
        
        queue.push(...newUrls.filter(url => !visitedUrls.has(url)));
        await page.close();
        
        // Rate limiting
        await wait(RATE_LIMIT_MS);
      } catch (error) {
        console.error(`❌ Error processing ${currentUrl}:`, error);
        continue;
      }
    }

    console.log(`\n✅ Crawl complete! Processed ${pages.length} pages`);
    return pages;
  } finally {
    await browser.close();
  }
}


/**
 * Extract comprehensive content from a rendered page
 */
async function extractPageContent(page: Page, url: string): Promise<ExtractedPageContent> {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      // Wait for content to stabilize
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      // Extract all content in browser context
      const extractedData = await page.evaluate(() => {
        // Helper function to clean text
        const cleanText = (text: string) => text.trim().replace(/\s+/g, ' ');
        
        // Extract metadata
        const metadata: PageMetadata = {};
        
        // Basic metadata
        metadata.title = document.title;
        
        const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
        if (metaDescription) metadata.description = metaDescription.content;
        
        const metaKeywords = document.querySelector('meta[name="keywords"]') as HTMLMetaElement;
        if (metaKeywords) metadata.keywords = metaKeywords.content.split(',').map(k => k.trim());
        
        const metaAuthor = document.querySelector('meta[name="author"]') as HTMLMetaElement;
        if (metaAuthor) metadata.author = metaAuthor.content;
        
        const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
        if (canonicalLink) metadata.canonicalUrl = canonicalLink.href;
        
        const htmlLang = document.documentElement.lang;
        if (htmlLang) metadata.language = htmlLang;
        
        // Open Graph metadata
        const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
        const ogDescription = document.querySelector('meta[property="og:description"]') as HTMLMetaElement;
        const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
        const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement;
        const ogType = document.querySelector('meta[property="og:type"]') as HTMLMetaElement;
        
        if (ogTitle || ogDescription || ogImage || ogUrl || ogType) {
          metadata.openGraph = {
            title: ogTitle?.content,
            description: ogDescription?.content,
            image: ogImage?.content,
            url: ogUrl?.content,
            type: ogType?.content
          };
        }
        
        // JSON-LD structured data
        const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        metadata.jsonLd = jsonLdScripts.map(script => {
          try {
            return JSON.parse(script.textContent || '');
          } catch {
            return null;
          }
        }).filter(Boolean);
        
        // Extract semantic content
        const semanticContent: SemanticContent = {
          headings: [],
          paragraphs: [],
          lists: [],
          altTexts: [],
          ariaLabels: [],
          landmarks: []
        };
        
        // Headings
        const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        semanticContent.headings = Array.from(headingElements).map(h => ({
          level: parseInt(h.tagName.charAt(1)),
          text: cleanText(h.textContent || ''),
          id: h.id || undefined
        }));
        
        // Paragraphs
        const paragraphElements = document.querySelectorAll('p');
        semanticContent.paragraphs = Array.from(paragraphElements)
          .map(p => cleanText(p.textContent || ''))
          .filter(text => text.length > 0);
        
        // Lists
        const listElements = document.querySelectorAll('ul, ol');
        semanticContent.lists = Array.from(listElements).map(list => ({
          type: list.tagName.toLowerCase() as 'ul' | 'ol',
          items: Array.from(list.querySelectorAll('li'))
            .map(li => cleanText(li.textContent || ''))
            .filter(text => text.length > 0)
        }));
        
        // Alt texts
        const imgElements = document.querySelectorAll('img[alt]');
        semanticContent.altTexts = Array.from(imgElements)
          .map(img => cleanText((img as HTMLImageElement).alt))
          .filter(alt => alt.length > 0);
        
        // ARIA labels
        const ariaElements = document.querySelectorAll('[aria-label]');
        semanticContent.ariaLabels = Array.from(ariaElements)
          .map(el => cleanText(el.getAttribute('aria-label') || ''))
          .filter(label => label.length > 0);
        
        // Landmarks
        const landmarkElements = document.querySelectorAll('[role]');
        semanticContent.landmarks = Array.from(landmarkElements).map(el => ({
          role: el.getAttribute('role') || '',
          label: el.getAttribute('aria-label') || undefined,
          content: cleanText(el.textContent || '').substring(0, 200) // Limit content length
        }));
        
        // Extract code samples
        const codeSamples: Omit<CodeSample, 'id' | 'detectedLanguage' | 'confidence'>[] = [];
        
        // Look for various code block patterns
        const codeSelectors = [
          'pre code',
          'pre',
          '.highlight pre',
          '.code-block',
          '[class*="language-"]',
          '[class*="hljs"]',
          '.codehilite',
          '.highlight',
          '.code-sample'
        ];
        
        codeSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          Array.from(elements).forEach((el) => {
            const code = el.textContent || '';
            if (code.trim().length === 0) return;
            
            // Try to detect language from class names
            let language: string | undefined;
            const classList = Array.from(el.classList);
            const parentClassList = el.parentElement ? Array.from(el.parentElement.classList) : [];
            
            for (const className of [...classList, ...parentClassList]) {
              if (className.startsWith('language-')) {
                language = className.replace('language-', '');
                break;
              } else if (className.startsWith('hljs-')) {
                language = className.replace('hljs-', '');
                break;
              } else if (['javascript', 'typescript', 'jsx', 'tsx', 'css', 'html', 'json', 'python', 'bash', 'shell'].includes(className)) {
                language = className;
                break;
              }
            }
            
            // Get context from surrounding elements
            let context = '';
            const prevSibling = el.previousElementSibling;
            
            if (prevSibling && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P'].includes(prevSibling.tagName)) {
              context = cleanText(prevSibling.textContent || '').substring(0, 100);
            }
            
            codeSamples.push({
              code: code.trim(),
              language,
              context,
              sourceElement: el.tagName.toLowerCase() + (el.className ? `.${el.className}` : ''),
              lineNumbers: el.querySelector('.line-number') !== null || 
                          el.closest('[class*="line-number"]') !== null
            });
          });
        });
        
        // Get full text content for the page
        const textContent = cleanText(document.body.textContent || '');
        
        return {
          metadata,
          semanticContent,
          codeSamples,
          textContent
        };
      });
      
      // Process code samples with language detection
      const processedCodeSamples: CodeSample[] = extractedData.codeSamples.map((sample, index) => {
        let detectedLanguage: string | undefined;
        let confidence = 0;
        
        // If no language detected from classes, try automatic detection
        if (!sample.language && sample.code.length > 20) {
          try {
            // Use highlight.js auto-detection
            const highlighted = hljs.highlightAuto(sample.code);
            if (highlighted.language && highlighted.relevance > 5) {
              detectedLanguage = highlighted.language;
              confidence = highlighted.relevance / 100;
            }
          } catch (error) {
            console.warn('Language detection failed:', error);
          }
        }
        
        return {
          id: `code-${Date.now()}-${index}`,
          ...sample,
          detectedLanguage,
          confidence
        };
      });
      
      return {
        id: `page-${Date.now()}`,
        url,
        textContent: extractedData.textContent,
        semanticContent: extractedData.semanticContent,
        metadata: extractedData.metadata,
        codeSamples: processedCodeSamples,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      retries++;
      if (retries === MAX_RETRIES) {
        throw error;
      }
      await wait(RATE_LIMIT_MS);
    }
  }
  
  throw new Error('Max retries exceeded');
}

/**
 * Legacy function to maintain compatibility with existing code
 * Converts new format to old ContentChunk format
 */
export async function crawlDesignSystemLegacy(
  url: string,
  onProgress: (progress: CrawlProgress) => void,
  signal?: AbortSignal
): Promise<ContentChunk[]> {
  const pages = await crawlDesignSystem(url, onProgress, signal);
  
  return pages.map(page => ({
    id: page.id,
    content: page.textContent,
    type: 'html' as const,
    metadata: {
      sourceUrl: page.url,
      title: page.metadata.title,
      description: page.metadata.description,
      codeSamples: page.codeSamples.length,
      timestamp: page.timestamp
    }
  }));
}

// Keep legacy functions for backward compatibility
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
  const $ = cheerio.load(html);
  
  // Try to find component type/name from various possible locations
  const type = $('h1, h2, [class*="title"], [class*="heading"]').first().text().trim() || '';
  
  // Look for prop definitions in tables and definition lists
  const props: string[] = [];
  
  // Check tables
  $('table').each((_, table) => {
    const headers = $(table).find('th').map((_, th) => $(th).text().toLowerCase()).get();
    if (headers.some(h => h.includes('prop') || h.includes('parameter'))) {
      $(table).find('tr').each((_, row) => {
        const cells = $(row).find('td').map((_, td) => $(td).text().trim()).get();
        if (cells.length > 0) {
          props.push(cells.join(' | '));
        }
      });
    }
  });
  
  // Check definition lists
  $('dl').each((_, dl) => {
    $(dl).find('dt').each((index, dt) => {
      const dd = $(dl).find('dd').eq(index);
      if (dt && dd.length) {
        props.push(`${$(dt).text().trim()} | ${dd.text().trim()}`);
      }
    });
  });
  
  // Get component description from various possible locations
  let description = '';
  $('p, [class*="description"], [class*="intro"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > description.length && !text.includes('import') && !text.includes('require')) {
      description = text;
    }
  });
  
  // Extract code examples
  const examples = $('pre code, [class*="example"] code, [class*="preview"] code')
    .map((_, code) => $(code).text().trim())
    .get()
    .filter(code => code.length > 0);
  
  return { type, props, description, examples };
}

async function extractUrls(page: Page, baseUrl: string): Promise<string[]> {
  const newUrls: string[] = [];
  const baseUrlObj = new URL(baseUrl);

  // Get all links on the page
  const hrefs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.getAttribute('href'))
      .filter(href => href != null) as string[];
  });

  // Process and filter URLs
  hrefs.forEach(href => {
    try {
      const url = new URL(href, baseUrl);
      // Only include URLs from the same host
      if (url.hostname === baseUrlObj.hostname && 
          !url.pathname.includes('/api/') &&
          !url.pathname.endsWith('.png') &&
          !url.pathname.endsWith('.jpg') &&
          !url.pathname.endsWith('.jpeg') &&
          !url.pathname.endsWith('.gif') &&
          !url.pathname.endsWith('.svg') &&
          !url.pathname.endsWith('.css') &&
          !url.pathname.endsWith('.js')) {
        newUrls.push(url.toString());
      }
    } catch {
      console.warn('Invalid URL:', href);
    }
  });

  return [...new Set(newUrls)]; // Remove duplicates
}
