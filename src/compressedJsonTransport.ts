export interface CompressedJsonPostResult {
  response: Response;
  originalBytes: number;
  transferredBytes: number;
  compressed: boolean;
}

/**
 * Sends JSON gzip-compressed when the browser supports CompressionStream.
 * Express' JSON parser inflates gzip request bodies transparently, so the
 * server endpoint remains unchanged. Falls back to plain JSON on older
 * browsers without changing replay semantics.
 */
export async function postJsonCompressed(url: string, json: string): Promise<CompressedJsonPostResult> {
  const originalBytes = new TextEncoder().encode(json).byteLength;

  if (typeof CompressionStream !== 'undefined') {
    const source = new Blob([json], { type: 'application/json' }).stream();
    const compressedStream = source.pipeThrough(new CompressionStream('gzip'));
    const compressed = await new Response(compressedStream).arrayBuffer();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip'
      },
      body: compressed
    });
    return {
      response,
      originalBytes,
      transferredBytes: compressed.byteLength,
      compressed: true
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json
  });
  return {
    response,
    originalBytes,
    transferredBytes: originalBytes,
    compressed: false
  };
}
