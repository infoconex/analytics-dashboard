import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../design-tokens.css', import.meta.url), 'utf8');

function token(name: string): string {
  const value = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  if (!value) throw new Error(`Missing opaque color token: ${name}`);
  return value;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(index => {
    const linear = parseInt(hex.slice(index, index + 2), 16) / 255;
    return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrast(first: string, second: string): number {
  const values = [luminance(token(first)), luminance(token(second))].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe('semantic color-token contrast guardrails', () => {
  it.each([
    ['text', 'surface'], ['muted', 'surface'], ['subtle', 'surface'],
    ['primary', 'surface'], ['on-primary', 'primary'],
    ['nav-text', 'nav'], ['danger', 'danger-surface'],
  ])('%s remains at least 4.5:1 against %s', (text, background) => {
    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('focus color remains at least 3:1 against the primary surfaces', () => {
    expect(contrast('focus', 'surface')).toBeGreaterThanOrEqual(3);
    expect(contrast('focus', 'canvas')).toBeGreaterThanOrEqual(3);
  });
});
