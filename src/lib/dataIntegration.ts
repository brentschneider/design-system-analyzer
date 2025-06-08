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
  console.log('🔄 Converting pages to components...');
  const components: Component[] = [];
  let totalHeadings = 0;
  let totalCodeSamples = 0;
  
  pages.forEach((page, pageIndex) => {
    console.log(`\n📄 Processing page ${pageIndex + 1}: ${page.url}`);
    console.log(`   - Headings (${page.semanticContent.headings.length}):`);
    page.semanticContent.headings.forEach(h => {
      console.log(`     - [H${h.level}] "${h.text}" -> ${isComponentHeading(h.text) ? '✅' : '❌'}`);
    });
    totalHeadings += page.semanticContent.headings.length;
    
    console.log(`   - Code samples (${page.codeSamples.length}):`);
    page.codeSamples.forEach((sample) => {
      const isComponent = isComponentCode(sample.code);
      const componentName = isComponent ? extractComponentNameFromCode(sample.code) : null;
      console.log(`     - [${sample.language || 'unknown'}] ${componentName ? `"${componentName}"` : 'No component'} -> ${isComponent ? '✅' : '❌'}`);
    });
    totalCodeSamples += page.codeSamples.length;
    
    // Try to extract component information from each page
    const componentMatches = extractComponentsFromPage(page);
    console.log(`   - Components extracted: ${componentMatches.length}`);
    components.push(...componentMatches);
  });

  console.log('\n📊 Summary:');
  console.log(`   - Pages processed: ${pages.length}`);
  console.log(`   - Total headings analyzed: ${totalHeadings}`);
  console.log(`   - Total code samples analyzed: ${totalCodeSamples}`);
  console.log(`   - Total components extracted: ${components.length}`);
  
  // Print found components
  if (components.length > 0) {
    console.log('\n🎯 Found components:');
    components.forEach((comp, i) => {
      console.log(`   ${i + 1}. ${comp.name}`);
      console.log(`      - Props: ${comp.props.length}`);
      console.log(`      - Examples: ${comp.codeSnippets.length}`);
    });
  }
  
  return components;
}

/**
 * Extract component information from a page
 */
function extractComponentsFromPage(page: ExtractedPageContent): Component[] {
  const components: Component[] = [];
  
  console.log(`   🔍 Analyzing page: ${page.url}`);
  
  // Look for component patterns in headings and code samples
  page.semanticContent.headings.forEach((heading) => {
    const isComponent = isComponentHeading(heading.text);
    console.log(`     H${heading.level}: "${heading.text}" -> ${isComponent ? '✅' : '❌'}`);
    
    if (isComponent) {
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
      
      console.log(`     ➕ Created component: "${component.name}"`);
      components.push(component);
    }
  });

  // Also check for components in code samples
  page.codeSamples.forEach((sample, index) => {
    const isComponent = isComponentCode(sample.code);
    const componentName = extractComponentNameFromCode(sample.code);
    const codePreview = sample.code.substring(0, 50).replace(/\n/g, ' ');
    
    console.log(`     Code ${index + 1}: "${codePreview}..." -> ${isComponent ? '✅' : '❌'}`);
    
    if (isComponent && componentName) {
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
      
      console.log(`     ➕ Created component from code: "${component.name}"`);
      components.push(component);
    }
  });

  console.log(`   📊 Page total: ${components.length} components`);
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
    // Extract headings more reliably, matching across lines
    const headingMatches = chunk.content.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi);
    if (headingMatches) {
      semanticContent.headings = headingMatches.map(match => {
        const level = parseInt(match.match(/<h([1-6])/)?.[1] || '1');
        // Remove any nested tags but preserve text content
        const text = match
          .replace(/<h[1-6][^>]*>/i, '')
          .replace(/<\/h[1-6]>/i, '')
          .replace(/<(?!\/?\w+>)/g, '&lt;')
          .replace(/<[^>]+>/g, '')
          .replace(/&lt;/g, '<')
          .trim();

        console.log(`📑 Extracted heading: [H${level}] "${text}"`);
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
    // Look for code blocks - use [\s\S] to match across lines
    const codeMatches = chunk.content.match(/<(?:pre|code)[^>]*>([\s\S]*?)<\/(?:pre|code)>/gi);
    if (codeMatches) {
      codeMatches.forEach((match, index) => {
        // Extract the content between the tags
        const content = match.replace(/<\/?(?:pre|code)[^>]*>/gi, '').trim();
        // Remove any nested code tags
        const code = content.replace(/<\/?code[^>]*>/gi, '').trim();
        
        if (code.length > 0) {
          // Try to detect language from class or data attributes
          let language = undefined;
          const langMatch = match.match(/(?:class|data-lang)=['"].*?(?:language-|lang-)([\w-]+)/i);
          if (langMatch) {
            language = langMatch[1];
          }

          codeSamples.push({
            id: `code-${Date.now()}-${index}`,
            code,
            language: language || detectLanguageFromCode(code),
            context: ''
          });

          console.log(`📦 Extracted code sample ${index + 1}:`, {
            preview: code.substring(0, 100),
            language: language || detectLanguageFromCode(code),
            length: code.length
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
  const componentPatterns = [
    // React/Web Component patterns
    /^[A-Z][a-zA-Z]*\s*(Component|Button|Input|Modal|Card|Form|Navigation|Menu|List|Table|Chart)/i,
    /^(Button|Input|Modal|Card|Form|Nav|Menu|List|Table|Chart|Badge|Alert|Toast|Avatar|Dropdown)/i,
    /Component$/i,
    // Common UI element patterns
    /(Button|Input|Form|Card|Modal|Dropdown|Menu|Nav|Header|Footer|Sidebar|Panel|Tab|Alert|Toast|Badge|Avatar|Icon|Label|Tooltip|Popover|Dialog|Accordion|Carousel|Spinner|Progress|Pagination|Breadcrumb|Tag|Switch|Checkbox|Radio|Select|Textarea|Table|List|Grid|Box|Container|Layout|Section|Group|Item|Link|Image|Video|Audio|Map|Chart|Graph|Timeline|Calendar|DatePicker|TimePicker|ColorPicker|Slider|RangeSlider|Upload|Download|Search|Filter|Sort|View|Preview|Editor|Viewer|Player|Controller|Manager|Handler|Provider|Context|Hook|Util|Helper|Service|Client|Server|Api|Interface|Template|Theme|Style|Config|Setting|Option|Preference|Profile|Account|User|Auth|Login|Logout|Register|Signup|Signin|Signout|Reset|Forgot|Verify|Validate|Confirm|Cancel|Submit|Save|Delete|Edit|Update|Create|Read|List|View|Add|Remove|Get|Set|Load|Unload|Start|Stop|Pause|Resume|Play|Next|Previous|First|Last|Top|Bottom|Left|Right|Center|Middle|Inner|Outer|Wrapper|Container|Layout|Grid|Flex|Stack|Row|Column|Cell|Header|Footer|Body|Content|Main|Side|Nav|Menu|Item|Link|Button|Input|Form|Label|Text|Title|Heading|Paragraph|Image|Icon|Logo|Brand|Badge|Tag|Card|Panel|Box|Section|Group|List|Table|Chart|Graph|Map|Timeline|Calendar|Modal|Dialog|Popup|Tooltip|Popover|Dropdown|Select|Checkbox|Radio|Switch|Slider|Progress|Spinner|Loader|Alert|Toast|Notification|Message|Error|Warning|Success|Info|Status|State|Loading|Empty|NotFound|Error|Exception|Fallback)\b/i,
    // Design system specific patterns
    /(Design System|Component Library|UI Kit|Pattern|Template|Theme|Style|Token|Variable|Color|Typography|Layout|Grid|Spacing|Size|Scale|Breakpoint|Media Query|Animation|Transition|Effect|Shadow|Border|Radius|Depth|Elevation|Layer|Stack|Position|Alignment|Flex|Grid|Container|Wrapper|Box|Section|Group|List|Item|Row|Column|Cell|Gutter|Gap|Margin|Padding|Width|Height|Size|Scale|Ratio|Proportion|Balance|Contrast|Hierarchy|Order|Flow|Direction|Orientation|Position|Placement|Arrangement|Distribution|Spacing|Padding|Margin|Border|Outline|Background|Foreground|Surface|Overlay|Layer|Level|Depth|Elevation|Shadow|Gradient|Pattern|Texture|Image|Icon|Logo|Brand|Badge|Label|Tag|Marker|Indicator|Signal|Status|State|Mode|Theme|Scheme|Palette|Swatch|Shade|Tint|Tone|Value|Weight|Style|Variant|Version|Option|Alternative|Choice|Selection|Setting|Property|Attribute|Parameter|Argument|Input|Output|Format|Type|Category|Group|Collection|Set|Suite|Library|System|Framework|Platform|Environment|Context|Scope|Domain|Space|Area|Region|Zone|Block|Element|Component|Module|Unit|Piece|Part|Segment|Section|Chunk|Fragment|Bit|Item|Entry|Record|Node|Point|Spot|Location|Position|Coordinates|Dimensions|Measurements|Metrics|Analytics|Statistics|Data|Information|Content|Message|Text|Copy|Label|Title|Heading|Description|Details|Summary|Abstract|Overview|Introduction|Conclusion|Body|Main|Content|Header|Footer|Navigation|Menu|Sidebar|Panel|Bar|Rail|Track|Route|Link|Connection|Relationship|Association|Dependency|Reference|Pointer|Target|Source|Origin|Destination|Start|End|Begin|Finish|Top|Bottom|Left|Right|Center|Middle|Front|Back|Side|Edge|Corner|Boundary|Limit|Threshold|Maximum|Minimum|Range|Interval|Period|Duration|Timeout|Delay|Speed|Velocity|Acceleration|Motion|Movement|Transition|Animation|Effect|Impact|Influence|Power|Force|Pressure|Stress|Load|Weight|Mass|Volume|Capacity|Size|Dimension|Scale|Ratio|Proportion|Balance|Harmony|Unity|Variety|Contrast|Emphasis|Dominance|Hierarchy|Order|Sequence|Series|Pattern|Rhythm|Repetition|Variation|Alternation|Progression|Regression|Cycle|Loop|Iteration|Step|Stage|Phase|Level|Layer|Depth|Height|Elevation|Grade|Rank|Status|State|Condition|Mode|Form|Shape|Structure|Construction|Composition|Organization|Arrangement|Configuration|Setup|Layout|Format|Style|Design|Theme|Scheme|System|Framework|Architecture|Infrastructure|Platform|Environment|Context|Scope|Domain|Field|Area|Space|Region|Zone|Territory|Realm|World|Universe|Dimension|Reality|Virtuality|Simulation|Emulation|Representation|Model|Template|Pattern|Example|Sample|Specimen|Instance|Case|Scenario|Situation|Condition|Circumstance|Event|Occurrence|Incident|Episode|Experience|Moment|Time|Period|Duration|Interval|Range|Scope|Extent|Reach|Coverage|Span|Spread|Distribution|Allocation|Assignment|Designation|Specification|Definition|Description|Explanation|Interpretation|Understanding|Comprehension|Knowledge|Information|Data|Content|Message|Signal|Communication|Transmission|Reception|Input|Output|Source|Target|Origin|Destination|Direction|Orientation|Position|Location|Placement|Arrangement|Organization|Structure|Construction|Composition|Formation|Creation|Generation|Production|Development|Evolution|Growth|Progress|Advancement|Improvement|Enhancement|Upgrade|Update|Revision|Version|Edition|Release|Publication|Distribution|Delivery|Service|Support|Maintenance|Operation|Function|Action|Activity|Task|Job|Work|Process|Procedure|Method|Technique|Approach|Strategy|Plan|Design|Scheme|System|Framework|Architecture|Structure|Organization|Management|Administration|Control|Regulation|Governance|Authority|Power|Force|Influence|Impact|Effect|Result|Outcome|Consequence|Product|Output|Deliverable|Achievement|Accomplishment|Success|Failure|Error|Problem|Issue|Challenge|Difficulty|Obstacle|Barrier|Limitation|Constraint|Restriction|Requirement|Specification|Standard|Rule|Policy|Procedure|Protocol|Convention|Practice|Custom|Tradition|Culture|Environment|Context|Situation|Condition|State|Status|Mode|Form|Type|Category|Class|Group|Kind|Sort|Style|Fashion|Trend|Mode|Pattern|Design|Structure|Organization|System|Framework|Architecture|Plan|Strategy|Method|Process|Procedure|Operation|Function|Action|Activity)/i,
  ];
  
  const normalizedText = text.trim();
  const isComponent = componentPatterns.some(pattern => pattern.test(normalizedText));
  
  if (isComponent) {
    console.log(`✅ Found component heading: "${normalizedText}"`);
  }
  
  return isComponent;
}

function isComponentCode(code: string): boolean {
  // Common patterns that indicate component code
  const componentPatterns = [
    // React/JSX
    /<[A-Z][a-zA-Z]*[^>]*>/,  // JSX component tags
    /function\s+[A-Z][a-zA-Z]*\s*\([^)]*\)\s*{/,  // Function components
    /class\s+[A-Z][a-zA-Z]*\s+extends\s+/,  // Class components
    /const\s+[A-Z][a-zA-Z]*\s*=\s*\([^)]*\)\s*=>/,  // Arrow function components
    /export\s+(?:default\s+)?(?:function|class|const)\s+[A-Z]/,  // Exported components
    /@Component\s*\(/,  // Angular components
    /Vue\.component\s*\(/,  // Vue components
    /component\s*:\s*{/,  // Vue SFC
    /styled\.[a-z]+`/,  // Styled components
    /@customElement\s*\(/,  // Web components
    /class\s+[A-Z][a-zA-Z]*\s+extends\s+HTMLElement/  // Web components
  ];

  const normalizedCode = code.trim();
  const isComponent = componentPatterns.some(pattern => pattern.test(normalizedCode));
  
  if (isComponent) {
    const preview = normalizedCode.substring(0, 100).replace(/\n/g, ' ');
    console.log(`✅ Found component code: "${preview}..."`);
  }
  
  return isComponent;
}

function extractComponentNameFromCode(code: string): string | null {
  const patterns = [
    // React/JSX patterns
    {
      pattern: /<([A-Z][a-zA-Z]*)[^>]*>/,
      group: 1
    },
    {
      pattern: /function\s+([A-Z][a-zA-Z]*)\s*\(/,
      group: 1
    },
    {
      pattern: /class\s+([A-Z][a-zA-Z]*)\s+extends/,
      group: 1
    },
    {
      pattern: /const\s+([A-Z][a-zA-Z]*)\s*=/,
      group: 1
    },
    {
      pattern: /export\s+(?:default\s+)?(?:function|class|const)\s+([A-Z][a-zA-Z]*)/,
      group: 1
    },
    // Angular patterns
    {
      pattern: /@Component\s*\([\s\S]*?selector\s*:\s*['"]([^'"]+)['"]/,
      group: 1
    },
    // Vue patterns
    {
      pattern: /Vue\.component\s*\(\s*['"]([^'"]+)['"]/,
      group: 1
    },
    {
      pattern: /name\s*:\s*['"]([^'"]+)['"]/,
      group: 1
    },
    // Web Component patterns
    {
      pattern: /@customElement\s*\(\s*['"]([^'"]+)['"]/,
      group: 1
    },
    {
      pattern: /customElements\.define\s*\(\s*['"]([^'"]+)['"]/,
      group: 1
    }
  ];

  for (const { pattern, group } of patterns) {
    const match = code.match(pattern);
    if (match && match[group]) {
      console.log(`📝 Extracted component name: "${match[group]}"`);
      return match[group];
    }
  }

  return null;
}

function findDescriptionForHeading(page: ExtractedPageContent, headingText: string): string {
  const { paragraphs } = page.semanticContent;
  const headingIndex = page.semanticContent.headings.findIndex(h => h.text === headingText);
  
  if (headingIndex === -1 || !paragraphs.length) return '';
  
  // Get the first non-empty paragraph after the heading
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    if (paragraph && !isComponentHeading(paragraph)) {
      return paragraph;
    }
  }
  
  return '';
}

function extractPropsFromPage(page: ExtractedPageContent): ComponentProp[] {
  const props: ComponentProp[] = [];
  
  // Look for prop tables in the page
  const propTables = (page.semanticContent.tables || []).filter(table => {
    if (!table.rows.length) return false;
    const headerRow = table.rows[0].join(' ').toLowerCase();
    return headerRow.includes('prop') || headerRow.includes('name') || headerRow.includes('parameter');
  });
  
  propTables.forEach(table => {
    const rows = table.rows;
    if (rows.length < 2) return;  // Need at least header + one row
    
    const headers = rows[0].map(h => (h || '').toLowerCase());
    const nameIndex = headers.findIndex(h => h.includes('prop') || h.includes('name') || h.includes('parameter'));
    const typeIndex = headers.findIndex(h => h.includes('type'));
    const requiredIndex = headers.findIndex(h => h.includes('required'));
    const descIndex = headers.findIndex(h => h.includes('desc'));
    
    rows.slice(1).forEach(row => {
      if (nameIndex !== -1 && row[nameIndex]) {
        props.push({
          name: row[nameIndex],
          type: typeIndex !== -1 ? row[typeIndex] : 'any',
          required: requiredIndex !== -1 ? (row[requiredIndex] || '').toLowerCase().includes('yes') : false,
          description: descIndex !== -1 ? row[descIndex] || '' : ''
        });
      }
    });
  });
  
  // Also try to extract props from code samples
  page.codeSamples.forEach(sample => {
    const codeProps = extractPropsFromCode(sample.code);
    codeProps.forEach(prop => {
      if (!props.find(p => p.name === prop.name)) {
        props.push(prop);
      }
    });
  });
  
  return props;
}

function extractPropsFromCode(code: string): ComponentProp[] {
  const props: ComponentProp[] = [];
  
  // Look for TypeScript/Flow prop types
  const interfaceMatch = code.match(/interface\s+\w+Props\s*{([^}]+)}/);
  if (interfaceMatch) {
    const propsText = interfaceMatch[1];
    const propMatches = propsText.match(/(\w+)(\?)?\s*:\s*([^;,\n]+)/g);
    
    if (propMatches) {
      propMatches.forEach(propMatch => {
        const [, name, optional, type] = propMatch.match(/(\w+)(\?)?\s*:\s*([^;,\n]+)/) || [];
        if (name && type) {
          props.push({
            name,
            type: type.trim(),
            required: !optional,
            description: `${name} property`
          });
        }
      });
    }
  }
  
  // Look for PropTypes
  const propTypesMatch = code.match(/\w+\.propTypes\s*=\s*{([^}]+)}/);
  if (propTypesMatch) {
    const propsText = propTypesMatch[1];
    const propMatches = propsText.match(/(\w+)\s*:\s*PropTypes\.([^.,\n]+)(\.isRequired)?/g);
    
    if (propMatches) {
      propMatches.forEach(propMatch => {
        const [, name, type, required] = propMatch.match(/(\w+)\s*:\s*PropTypes\.([^.,\n]+)(\.isRequired)?/) || [];
        if (name && type) {
          props.push({
            name,
            type,
            required: !!required,
            description: `${name} property`
          });
        }
      });
    }
  }
  
  return props;
}

function extractExamplesFromPage(page: ExtractedPageContent, componentName: string): string[] {
  const examples: string[] = [];
  
  // Look for code samples that contain the component name
  page.codeSamples.forEach(sample => {
    if (
      sample.code.includes(componentName) ||
      sample.code.includes(componentName.toLowerCase()) ||
      sample.code.includes(componentName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase())
    ) {
      examples.push(sample.code);
    }
  });
  
  return examples;
}

// Export singleton instances
export const autoSaveManager = new AutoSaveManager();
export const bulkDataManager = new BulkDataManager();
