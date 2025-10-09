// Unit tests for compression functionality
import pako from 'pako';

// Mock compression functions from the main component
function compressData(text) {
  try {
    const compressed = pako.deflate(text);
    const base64 = btoa(String.fromCharCode(...compressed));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (e) {
    console.error('Compression failed:', e);
    return '';
  }
}

function decompressData(compressed) {
  try {
    let base64 = compressed.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decompressed = pako.inflate(bytes, { to: 'string' });
    return decompressed;
  } catch (e) {
    console.error('Decompression failed:', e);
    return '';
  }
}

describe('Compression utilities', () => {
  test('compresses and decompresses simple text', () => {
    const original = '|Epic1|Task1|20|2025-01-01|Customer1|true|50|';
    const compressed = compressData(original);
    const decompressed = decompressData(compressed);
    
    expect(compressed).toBeTruthy();
    // Note: Small strings may be larger when compressed due to compression overhead
    // The main benefit is for larger datasets
    expect(decompressed).toBe(original);
  });

  test('compresses and decompresses multi-line markdown', () => {
    const original = `|Onboarding|Task 1|40||Ventinova|true|0|
|Onboarding|Task 2|20||Ventinova|true|25|
|Products|Task 3|30||Internal|true|100|`;
    
    const compressed = compressData(original);
    const decompressed = decompressData(compressed);
    const urlEncoded = encodeURIComponent(original);
    
    expect(compressed).toBeTruthy();
    // Compressed should be smaller than URL encoding (which is what we're replacing)
    expect(compressed.length).toBeLessThan(urlEncoded.length);
    expect(decompressed).toBe(original);
  });

  test('compressed string is URL-safe', () => {
    const original = '|Epic|Task with special chars: + / = & ?|25||Customer|true|0|';
    const compressed = compressData(original);
    
    // Should not contain +, /, or = characters (URL-unsafe)
    expect(compressed).not.toContain('+');
    expect(compressed).not.toContain('/');
    expect(compressed).not.toContain('=');
    
    // Should decompress correctly
    const decompressed = decompressData(compressed);
    expect(decompressed).toBe(original);
  });

  test('achieves significant compression for larger datasets', () => {
    // Create a realistic larger markdown table
    const lines = Array(20).fill(null).map((_, i) => 
      `|Epic${Math.floor(i/3)}|Task description for item ${i}|${10 + i * 5}|2025-01-${String(1 + i % 28).padStart(2, '0')}|Customer${i % 5}|true|${i * 5}|`
    );
    const original = lines.join('\n');
    
    const compressed = compressData(original);
    const urlEncoded = encodeURIComponent(original);
    
    // Compressed should be significantly smaller than URL encoding
    const reduction = ((urlEncoded.length - compressed.length) / urlEncoded.length) * 100;
    expect(reduction).toBeGreaterThan(50); // At least 50% reduction
    
    // Should decompress correctly
    const decompressed = decompressData(compressed);
    expect(decompressed).toBe(original);
  });

  test('handles empty string', () => {
    const original = '';
    const compressed = compressData(original);
    const decompressed = decompressData(compressed);
    
    expect(compressed).toBeTruthy();
    expect(decompressed).toBe(original);
  });

  test('handles strings with special markdown characters', () => {
    const original = '|Epic|Task with | pipes | and * stars * and # hashes|30||Customer|true|75|';
    const compressed = compressData(original);
    const decompressed = decompressData(compressed);
    
    expect(decompressed).toBe(original);
  });
});
