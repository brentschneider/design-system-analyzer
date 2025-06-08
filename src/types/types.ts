export type ComponentProp = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

export type CodeSnippet = {
  description: string;
  code: string;
};

export type ComponentRelationship = {
  targetComponentId: string;
  type: string;
};

export type Component = {
  id: string;
  sourceId: string;
  name: string;
  description: string;
  props: ComponentProp[];
  codeSnippets: CodeSnippet[];
  relationships: ComponentRelationship[];
  metadata: Record<string, string | number | boolean>;
};

export type DesignSystemSource = {
  id: string;
  url: string;
  name: string;
  status: 'idle' | 'crawling' | 'analyzing' | 'complete' | 'error';
  error?: string;
  lastCrawled?: string; // ISO date string
};

export type CrawlProgress = {
  sourceId: string;
  pagesProcessed: number;
  totalPages: number;
  currentPage: string;
  componentsFound?: number;
};

export interface WebSocketMessage {
  type: 'progress' | 'status' | 'component' | 'ping' | 'pong';
  sourceId?: string;
  progress?: CrawlProgress;
  status?: string;
  error?: string;
  component?: Component;
}

export interface ContentChunk {
  id: string;
  content: string;
  type: 'html' | 'markdown' | 'jsx' | 'tsx';
  metadata?: Record<string, unknown>;
}

export interface PageMetadata {
  title?: string;
  description?: string;
  keywords?: string[];
  author?: string;
  openGraph?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
  };
  jsonLd?: Record<string, unknown>[];
  canonicalUrl?: string;
  language?: string;
  lastModified?: string;
  sourceUrl?: string;
  componentId?: string;
}

export interface CodeSample {
  id: string;
  code: string;
  language?: string;
  detectedLanguage?: string;
  confidence?: number;
  context?: string;
  sourceElement?: string;
  lineNumbers?: boolean;
}

export interface SemanticContent {
  headings: Array<{
    level: number;
    text: string;
    id?: string;
    position?: number;
  }>;
  paragraphs: string[];
  lists: Array<{
    type: 'ul' | 'ol';
    items: string[];
    position?: number;
  }>;
  altTexts: string[];
  ariaLabels: string[];
  landmarks: Array<{
    role: string;
    label?: string;
    content?: string;
    position?: number;
  }>;
  tables?: Array<{
    rows: string[][];
    position?: number;
  }>;
}

export interface ExtractedPageContent {
  id: string;
  url: string;
  textContent: string;
  semanticContent: SemanticContent;
  metadata: PageMetadata;
  codeSamples: CodeSample[];
  timestamp: string;
  renderTime?: number;
  errors?: string[];
}

declare global {
  // eslint-disable-next-line no-var
  var io: unknown;
}
