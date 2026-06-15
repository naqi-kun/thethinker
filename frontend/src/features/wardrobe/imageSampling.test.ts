import { describe, expect, it } from 'vitest';
import { displayedToNaturalPixel, rgbToHex } from './imageSampling';
import { nearestNamedColor } from './colorMatch';

describe('rgbToHex', () => {
  it('formats primary channels', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
  });
  it('zero-pads single-digit channels', () => {
    expect(rgbToHex({ r: 1, g: 2, b: 3 })).toBe('#010203');
  });
  it('rounds and clamps out-of-range channels', () => {
    expect(rgbToHex({ r: 255.6, g: -4, b: 300 })).toBe('#ff00ff');
  });
});

describe('displayedToNaturalPixel — contain', () => {
  // 100×100 image in a 200×100 box → letterbox bars on the left/right.
  it('returns null over a left letterbox bar', () => {
    expect(displayedToNaturalPixel(10, 50, 200, 100, 100, 100, 'contain')).toBeNull();
  });
  it('maps the content left edge to pixel x=0', () => {
    expect(displayedToNaturalPixel(50, 0, 200, 100, 100, 100, 'contain')).toEqual({
      x: 0,
      y: 0,
    });
  });
  it('maps just past the content right edge to null', () => {
    expect(displayedToNaturalPixel(150, 50, 200, 100, 100, 100, 'contain')).toBeNull();
  });
  it('handles a non-square image with vertical letterboxing', () => {
    // 200×100 image in a 100×100 box → scale 0.5, content 100×50, originY 25.
    expect(displayedToNaturalPixel(0, 25, 100, 100, 200, 100, 'contain')).toEqual({
      x: 0,
      y: 0,
    });
    expect(displayedToNaturalPixel(0, 10, 100, 100, 200, 100, 'contain')).toBeNull();
  });
});

describe('displayedToNaturalPixel — cover', () => {
  it('maps the box centre to the image centre', () => {
    // 100×100 image in a 200×100 box → scale 2, fills the box and crops top/bottom.
    expect(displayedToNaturalPixel(100, 50, 200, 100, 100, 100, 'cover')).toEqual({
      x: 50,
      y: 50,
    });
  });
});

describe('displayedToNaturalPixel — degenerate input', () => {
  it('returns null for zero dimensions', () => {
    expect(displayedToNaturalPixel(0, 0, 0, 0, 100, 100, 'contain')).toBeNull();
    expect(displayedToNaturalPixel(0, 0, 100, 100, 0, 0, 'cover')).toBeNull();
  });
});

describe('sampled hex snaps to the right named colour', () => {
  it('a red pixel snaps to red', () => {
    expect(nearestNamedColor(rgbToHex({ r: 255, g: 0, b: 0 }))).toBe('red');
  });
  it('a dark navy pixel snaps to navy blue', () => {
    expect(nearestNamedColor(rgbToHex({ r: 31, g: 58, b: 95 }))).toBe('navy blue');
  });
});
