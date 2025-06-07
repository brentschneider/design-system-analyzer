import { NextResponse } from 'next/server';

async function queryOllama(content: string, sourceUrl?: string) {
  try {
    const prompt = `Extract component info from this code. Return only JSON:

${content.substring(0, 500)}

Format: {"componentName": "Button", "description": "brief desc", "props": [{"name": "variant", "type": "string", "required": false, "description": "desc"}]}`;

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000), // 30 second timeout
      body: JSON.stringify({
        model: 'llama3:latest',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9,
          max_tokens: 500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.response || '';
    
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Raw text:', text);
      }
    }
    
    // Fallback response
    return {
      componentName: 'Unknown Component',
      description: `Component extracted from ${sourceUrl || 'design system'}`,
      props: []
    };
  } catch (error) {
    console.error('Ollama error:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { chunks } = await request.json();
    
    console.log(`Analyzing ${chunks.length} content chunks...`);
    
    const results = [];
    
    // Process chunks in batches to avoid overwhelming Ollama
    for (let i = 0; i < Math.min(chunks.length, 5); i++) {
      const chunk = chunks[i];
      console.log(`Analyzing chunk ${i + 1}/${Math.min(chunks.length, 5)}`);
      
      const ollamaResult = await queryOllama(chunk.content, chunk.metadata?.sourceUrl);
      
      if (ollamaResult) {
        results.push({
          id: chunk.id,
          name: ollamaResult.componentName,
          description: ollamaResult.description,
          props: ollamaResult.props || [],
          codeSnippets: [
            {
              language: 'typescript',
              code: chunk.content.substring(0, 500) + (chunk.content.length > 500 ? '...' : ''),
              description: 'Component implementation'
            }
          ],
          relationships: [],
          metadata: { 
            analyzedAt: new Date().toISOString(), 
            source: 'ollama',
            sourceUrl: chunk.metadata?.sourceUrl 
          }
        });
      } else {
        // Fallback for failed Ollama analysis
        results.push({
          id: chunk.id,
          name: `Component ${i + 1}`,
          description: `Component from ${chunk.metadata?.sourceUrl || 'design system'}`,
          props: [
            { name: 'variant', type: 'string', required: false, description: 'Component variant' },
            { name: 'size', type: 'string', required: false, description: 'Component size' }
          ],
          codeSnippets: [],
          relationships: [],
          metadata: { 
            analyzedAt: new Date().toISOString(), 
            source: 'fallback',
            sourceUrl: chunk.metadata?.sourceUrl 
          }
        });
      }
      
      // Small delay between requests to be nice to Ollama
      if (i < Math.min(chunks.length, 5) - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Analysis complete. Generated ${results.length} component definitions.`);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Analysis failed' 
    }, { status: 500 });
  }
}
