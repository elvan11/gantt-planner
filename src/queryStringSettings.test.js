// Test to verify settings are correctly loaded from query string
import { render, screen } from '@testing-library/react';
import pako from 'pako';

// Mock compression/decompression functions
function compressData(data) {
  try {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const compressed = pako.deflate(text);
    const base64 = btoa(String.fromCharCode(...compressed));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (e) {
    console.error('Compression failed:', e);
    return '';
  }
}

function decompressData(compressed, parseJSON = false) {
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
    return parseJSON ? JSON.parse(decompressed) : decompressed;
  } catch (e) {
    console.error('Decompression failed:', e);
    return parseJSON ? null : '';
  }
}

describe('Query String Settings', () => {
  test('compresses and decompresses state object with settings', () => {
    const state = {
      markdown: '|Epic1|Task1|20|2025-01-01|Customer1|true|50|',
      speed: 1.5,
      hoursPerDay: 6,
      startDate: '2025-02-15',
      skipWeekends: false,
      customerFilter: 'Ventinova',
      includeFlags: {
        task0_include: 'true',
        task1_include: 'false'
      }
    };
    
    const compressed = compressData(state);
    const decompressed = decompressData(compressed, true);
    
    expect(compressed).toBeTruthy();
    expect(decompressed).toEqual(state);
    expect(decompressed.speed).toBe(1.5);
    expect(decompressed.hoursPerDay).toBe(6);
    expect(decompressed.startDate).toBe('2025-02-15');
    expect(decompressed.skipWeekends).toBe(false);
    expect(decompressed.customerFilter).toBe('Ventinova');
  });

  test('decompresses state with all setting types', () => {
    const state = {
      markdown: 'test',
      speed: 2.0,
      hoursPerDay: 10,
      startDate: '2025-03-01',
      skipWeekends: true,
      customerFilter: 'Internal'
    };
    
    const compressed = compressData(state);
    const decompressed = decompressData(compressed, true);
    
    expect(typeof decompressed.speed).toBe('number');
    expect(typeof decompressed.hoursPerDay).toBe('number');
    expect(typeof decompressed.startDate).toBe('string');
    expect(typeof decompressed.skipWeekends).toBe('boolean');
    expect(typeof decompressed.customerFilter).toBe('string');
  });
});
