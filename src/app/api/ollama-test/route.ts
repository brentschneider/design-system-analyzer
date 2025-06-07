import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Testing Ollama connection...');
    
    // First, test if Ollama is accessible
    const healthResponse = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (!healthResponse.ok) {
      return NextResponse.json({ 
        error: 'Ollama not accessible',
        status: healthResponse.status 
      }, { status: 500 });
    }
    
    const models = await healthResponse.json();
    console.log('Available models:', models);
    
    // Test a simple generation
    const generateResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000), // 10 second timeout
      body: JSON.stringify({
        model: 'llama3:latest',
        prompt: 'Say hello in exactly 3 words.',
        stream: false
      })
    });
    
    if (!generateResponse.ok) {
      return NextResponse.json({ 
        error: 'Generate request failed',
        status: generateResponse.status,
        models: models
      }, { status: 500 });
    }
    
    const result = await generateResponse.json();
    console.log('Generation result:', result);
    
    return NextResponse.json({ 
      success: true, 
      models: models,
      testResponse: result.response,
      message: 'Ollama is working correctly'
    });
    
  } catch (error) {
    console.error('Ollama test error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : 'Unknown'
    }, { status: 500 });
  }
}
