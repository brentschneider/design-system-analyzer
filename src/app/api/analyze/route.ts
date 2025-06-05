import { NextResponse } from 'next/server';
import { ContentChunk, Component, PropDefinition, CodeSnippet, ComponentRelationship } from '../../../types/types';

interface OllamaAnalysis {
  componentName: string;
  type: string;
  description: string;
  props: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    defaultValue?: string;
  }>;
  codeSnippets: Array<{
    code: string;
    language: string;
    type: 'example' | 'implementation';
    description?: string;
  }>;
  relationships: Array<{
    type: 'imports' | 'extends' | 'uses';
    targetComponentName: string;
  }>;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function queryOllama(content: string, retryCount = 0): Promise<OllamaAnalysis | null> {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama2',
        prompt: `Analyze this design system documentation and extract component information.
Format the response as JSON with the following schema:
{
  "componentName": string,
  "type": string,
  "description": string,
  "props": Array<{
    name: string,
    type: string,
    required: boolean,
    description: string,
    defaultValue?: string
  }>,
  "codeSnippets": Array<{
    code: string,
    language: string,
    type: "example" | "implementation",
    description?: string
  }>,
  "relationships": Array<{
    type: "imports" | "extends" | "uses",
    targetComponentName: string
  }>
}

Content to analyze:
${content}`,
        temperature: 0.1, // Lower temperature for more focused responses
        max_tokens: 2048 // Ensure enough tokens for complex components
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Validate response format
    let parsed: OllamaAnalysis;
    try {
      parsed = JSON.parse(result.response);
      
      // Basic schema validation
      if (!parsed.componentName || typeof parsed.componentName !== 'string') {
        throw new Error('Invalid response: missing or invalid componentName');
      }
      
      if (!Array.isArray(parsed.props)) {
        throw new Error('Invalid response: props must be an array');
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to parse Ollama response:', error);
      
      // Retry on parsing errors
      if (retryCount < MAX_RETRIES) {
        await wait(RETRY_DELAY);
        return queryOllama(content, retryCount + 1);
      }
      
      return null;
    }
  } catch (error) {
    console.error('Ollama API error:', error);
    
    // Retry on network errors
    if (retryCount < MAX_RETRIES) {
      await wait(RETRY_DELAY);
      return queryOllama(content, retryCount + 1);
    }
    
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { chunks }: { chunks: ContentChunk[] } = await request.json();
    
    const processChunk = async (chunk: ContentChunk): Promise<Partial<Component> | null> => {
      try {
        const analysis = await queryOllama(chunk.content);
        if (!analysis) {
          console.warn('Failed to analyze chunk:', chunk.metadata.sourceUrl);
          return null;
        }
        
        // Clean and validate the analysis result
        const cleanProps = analysis.props.map(p => ({
          name: p.name.trim(),
          type: p.type.trim(),
          required: Boolean(p.required),
          description: p.description.trim(),
          defaultValue: p.defaultValue?.trim()
        }));
        
        const cleanSnippets = analysis.codeSnippets.map(s => ({
          code: s.code.trim(),
          language: s.language.toLowerCase(),
          type: s.type as 'example' | 'implementation',
          description: s.description?.trim()
        }));
        
        return {
          id: chunk.id,
          name: analysis.componentName.trim(),
          description: analysis.description.trim(),
          type: analysis.type.trim(),
          props: cleanProps as PropDefinition[],
          codeSnippets: cleanSnippets as CodeSnippet[],
          relationships: analysis.relationships.map((r): ComponentRelationship => ({
            type: r.type,
            targetComponentId: `temp-${r.targetComponentName.trim()}`
          })),
          sourceUrl: chunk.metadata.sourceUrl,
          metadata: {
            analyzedAt: new Date().toISOString(),
            section: chunk.metadata.section,
            confidence: 'high' // TODO: Implement confidence scoring
          }
        };
      } catch (error) {
        console.error('Error processing chunk:', error);
        return null;
      }
    };
    
    // Process chunks in parallel with a concurrency limit
    const concurrencyLimit = 5;
    const results: Array<Partial<Component>> = [];
    const errors: Array<{ url: string; error: string }> = [];
    
    for (let i = 0; i < chunks.length; i += concurrencyLimit) {
      const batch = chunks.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(async chunk => {
        try {
          return await processChunk(chunk);
        } catch (error) {
          errors.push({
            url: chunk.metadata.sourceUrl,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is Partial<Component> => r !== null));
    }
    
    if (errors.length > 0) {
      console.warn('Some chunks failed to process:', errors);
    }
    
    return NextResponse.json({ 
      success: true, 
      results,
      errors: errors.length > 0 ? errors : undefined 
    });
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred during analysis' },
      { status: 500 }
    );
  }
}
