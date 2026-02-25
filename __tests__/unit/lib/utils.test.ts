import { describe, it, expect } from 'vitest';
import { cn, formatPrice, formatPercent, formatDate } from '@/app/lib/utils';

describe('cn()', () => {
  it('empty call returns empty string', () => {
    expect(cn()).toBe('');
  });

  it('single class returns it', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('multiple classes are joined with space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('filters out falsy values: false', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar');
  });

  it('filters out falsy values: null', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar');
  });

  it('filters out falsy values: undefined', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
  });

  it('filters out falsy values: empty string', () => {
    expect(cn('foo', '', 'bar')).toBe('foo bar');
  });

  it('mix of truthy and falsy', () => {
    expect(cn('a', false, 'b', null, undefined, '', 'c')).toBe('a b c');
  });
});

describe('formatPrice()', () => {
  it('integer: 5000 → "5,000.00"', () => {
    expect(formatPrice(5000)).toBe('5,000.00');
  });

  it('decimal: 5432.1 → "5,432.10"', () => {
    expect(formatPrice(5432.1)).toBe('5,432.10');
  });

  it('large with rounding: 123456.789 → "123,456.79"', () => {
    expect(formatPrice(123456.789)).toBe('123,456.79');
  });

  it('small: 0.5 → "0.50"', () => {
    expect(formatPrice(0.5)).toBe('0.50');
  });
});

describe('formatPercent()', () => {
  it('positive: 1.24 → "+1.24%"', () => {
    expect(formatPercent(1.24)).toBe('+1.24%');
  });

  it('negative: -0.87 → "-0.87%"', () => {
    expect(formatPercent(-0.87)).toBe('-0.87%');
  });

  it('zero: 0 → "+0.00%" or "0.00%"', () => {
    const result = formatPercent(0);
    expect(result).toMatch(/^[+]?0\.00%$/);
  });
});

describe('formatDate()', () => {
  it('returns a non-empty string', () => {
    const result = formatDate(new Date('2026-02-25'));
    expect(result.length).toBeGreaterThan(0);
  });

  it('contains the year', () => {
    const result = formatDate(new Date('2026-02-25'));
    expect(result).toContain('2026');
  });

  it('contains a month name (abbreviated)', () => {
    const result = formatDate(new Date('2026-02-25'));
    // Feb or February
    expect(result).toMatch(/Feb/i);
  });

  it('returns different strings for different dates', () => {
    const a = formatDate(new Date('2026-01-01'));
    const b = formatDate(new Date('2026-06-15'));
    expect(a).not.toBe(b);
  });
});
