import { NextResponse } from 'next/server';
import { exportPages, ExportOptions } from '../../../lib/export';
import { ExtractedPageContent } from '../../../types/types';

export async function POST(request: Request) {
  try {
    const { pages, options }: { 
      pages: ExtractedPageContent[]; 
      options: ExportOptions;
    } = await request.json();

    if (!pages || !Array.isArray(pages)) {
      return NextResponse.json({ 
        error: 'Pages array is required' 
      }, { status: 400 });
    }

    if (!options || !options.format) {
      return NextResponse.json({ 
        error: 'Export options with format are required' 
      }, { status: 400 });
    }

    console.log(`Exporting ${pages.length} pages to ${options.format} format`);

    const exportResult = exportPages(pages, options);

    // Return export result with metadata
    return NextResponse.json({
      success: true,
      export: exportResult,
      summary: {
        totalPages: pages.length,
        totalCodeSamples: pages.reduce((sum, page) => sum + page.codeSamples.length, 0),
        exportSize: exportResult.size,
        additionalFiles: exportResult.additionalFiles?.length || 0,
        format: options.format
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Export failed',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Data Export API',
    description: 'Export crawled page content to various formats',
    supportedFormats: ['json', 'csv', 'markdown', 'html'],
    features: [
      'Multiple export formats (JSON, CSV, Markdown, HTML)',
      'Optional filtering of content types',
      'Separate code sample files',
      'Compressed JSON output',
      'Rich HTML reports with styling',
      'Markdown documentation format'
    ],
    usage: {
      method: 'POST',
      body: {
        pages: 'ExtractedPageContent[]',
        options: {
          format: 'json | csv | markdown | html',
          includeCodeSamples: 'boolean (default: true)',
          includeMetadata: 'boolean (default: true)',
          includeSemanticContent: 'boolean (default: true)',
          minifyJson: 'boolean (default: false)',
          separateCodeFiles: 'boolean (default: false)',
          filename: 'string (optional custom filename)'
        }
      }
    },
    examples: {
      basicJsonExport: {
        pages: '[ /* ExtractedPageContent objects */ ]',
        options: {
          format: 'json',
          minifyJson: false
        }
      },
      csvWithMetadata: {
        pages: '[ /* ExtractedPageContent objects */ ]',
        options: {
          format: 'csv',
          includeMetadata: true,
          includeCodeSamples: false
        }
      },
      separateCodeFiles: {
        pages: '[ /* ExtractedPageContent objects */ ]',
        options: {
          format: 'json',
          separateCodeFiles: true,
          filename: 'my-export'
        }
      }
    }
  });
}
