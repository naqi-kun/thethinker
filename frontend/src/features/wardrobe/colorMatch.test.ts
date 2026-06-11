import { describe, expect, it } from 'vitest';
import { hexToRgb, nearestNamedColor, suggestName } from './colorMatch';

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#1f3a5f')).toEqual({ r: 31, g: 58, b: 95 });
  });
  it('parses 3-digit shorthand', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });
  it('returns null for a gradient string', () => {
    expect(hexToRgb('linear-gradient(135deg, #e74c3c, #3498db)')).toBeNull();
  });
});

describe('nearestNamedColor', () => {
  it('maps pure black to black', () => {
    expect(nearestNamedColor('#000000')).toBe('black');
  });
  it('maps a dark navy to navy blue', () => {
    expect(nearestNamedColor('#1f3a5f')).toBe('navy blue');
  });
  it('maps a neutral mid-grey to grey', () => {
    expect(nearestNamedColor('#8a8a8a')).toBe('grey');
  });
  it('never returns multicolor (the gradient is excluded)', () => {
    const inputs = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#123456'];
    for (const hex of inputs) {
      expect(nearestNamedColor(hex)).not.toBe('multicolor');
    }
  });
});

describe('suggestName', () => {
  it('combines colour and type', () => {
    expect(suggestName('black', 't-shirt')).toBe('Black T-Shirt');
    expect(suggestName('navy blue', 'jeans')).toBe('Navy blue Jeans');
  });
  it('handles empty inputs gracefully', () => {
    expect(suggestName('', '')).toBe('');
  });
});
