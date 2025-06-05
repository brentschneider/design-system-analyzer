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

declare global {
  // eslint-disable-next-line no-var
  var io: unknown;
}
