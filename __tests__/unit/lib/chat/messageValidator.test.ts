import { describe, it, expect } from 'vitest';
import {
  validateUserMessage,
  sanitizeMessage,
  generateTitle,
  validateClaudeResponse,
} from '@/lib/chat/messageValidator';

describe('validateUserMessage()', () => {
  it('accepts a valid message', () => {
    const result = validateUserMessage('Hello, what is the IV for SPWX?');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects non-string input (number)', () => {
    const result = validateUserMessage(42);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/string/i);
  });

  it('rejects non-string input (object)', () => {
    const result = validateUserMessage({ text: 'hello' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/string/i);
  });

  it('rejects non-string input (null)', () => {
    const result = validateUserMessage(null);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/string/i);
  });

  it('rejects empty string', () => {
    const result = validateUserMessage('');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it('rejects whitespace-only string', () => {
    const result = validateUserMessage('   \t\n  ');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it('accepts message at exactly max length (5000 chars)', () => {
    const message = 'a'.repeat(5000);
    const result = validateUserMessage(message);
    expect(result.valid).toBe(true);
  });

  it('rejects message exceeding max length (5001 chars)', () => {
    const message = 'a'.repeat(5001);
    const result = validateUserMessage(message);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/5000/);
  });
});

describe('sanitizeMessage()', () => {
  it('passes through clean text unchanged', () => {
    const text = 'What is the implied volatility for SPWX calls?';
    expect(sanitizeMessage(text)).toBe(text);
  });

  it('removes script tags and their content', () => {
    const input = 'Hello <script>alert("xss")</script> world';
    const result = sanitizeMessage(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert("xss")');
    expect(result).not.toContain('</script>');
    expect(result).toContain('Hello');
    expect(result).toContain('world');
  });

  it('removes script tags case-insensitively', () => {
    const input = '<SCRIPT>evil()</SCRIPT>';
    expect(sanitizeMessage(input)).not.toContain('evil()');
  });

  it('removes iframe tags and their content', () => {
    const input = 'text <iframe src="evil.com"></iframe> more';
    const result = sanitizeMessage(input);
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('evil.com');
    expect(result).toContain('text');
    expect(result).toContain('more');
  });

  it('removes tags with inline event handlers', () => {
    const input = '<div onclick="evil()">click me</div>';
    const result = sanitizeMessage(input);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('evil()');
  });

  it('removes onerror event handlers', () => {
    const input = '<img src="x" onerror="evil()">';
    const result = sanitizeMessage(input);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('evil()');
  });

  it('removes javascript: URLs in href attributes', () => {
    const input = '<a href="javascript:evil()">click</a>';
    const result = sanitizeMessage(input);
    expect(result).not.toContain('javascript:evil()');
  });

  it('removes javascript: URLs in src attributes', () => {
    const input = '<img src="javascript:evil()">';
    const result = sanitizeMessage(input);
    expect(result).not.toContain('javascript:evil()');
  });

  it('removes standalone javascript: references', () => {
    const input = 'Go to javascript:void(0)';
    const result = sanitizeMessage(input);
    expect(result).not.toMatch(/javascript\s*:/i);
  });

  it('preserves normal markdown formatting', () => {
    const input = '**bold** and _italic_ and `code`';
    expect(sanitizeMessage(input)).toBe(input);
  });
});

describe('generateTitle()', () => {
  it('uses the message as-is when under 60 chars', () => {
    const msg = 'What is the IV for SPWX?';
    expect(generateTitle(msg)).toBe(msg);
  });

  it('extracts question from longer message', () => {
    const msg = 'I have a question. What is the implied volatility for SPWX calls today?';
    const title = generateTitle(msg);
    expect(title).toContain('What is the implied volatility');
    expect(title.length).toBeLessThanOrEqual(63); // 60 + possible "..."
  });

  it('truncates long non-question messages to ~60 chars', () => {
    const msg = 'This is a very long message that does not have a question mark and goes on for a very long time';
    const title = generateTitle(msg);
    expect(title.length).toBeLessThanOrEqual(63);
    expect(title).toContain('...');
  });

  it('truncates at word boundary when possible', () => {
    const msg = 'Tell me about the financial performance metrics for this quarter';
    const title = generateTitle(msg);
    // Should not cut in the middle of a word
    expect(title).not.toMatch(/\w\.\.\./); // no word immediately before ...
  });

  it('handles exactly 60 char message without truncation', () => {
    const msg = 'a'.repeat(60);
    const title = generateTitle(msg);
    expect(title).toBe(msg);
    expect(title).not.toContain('...');
  });

  it('trims leading/trailing whitespace', () => {
    const msg = '  What is the IV?  ';
    expect(generateTitle(msg)).toBe('What is the IV?');
  });

  it('prefers question over long preamble', () => {
    const msg = 'I was looking at the market and I noticed something interesting. What is the implied volatility for SPWX options expiring this Friday?';
    const title = generateTitle(msg);
    expect(title).toContain('What is the implied volatility');
  });
});

describe('validateClaudeResponse()', () => {
  it('accepts a valid response', () => {
    const result = validateClaudeResponse('The implied volatility for SPWX is 25.3%.');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects non-string input', () => {
    const result = validateClaudeResponse(null);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/string/i);
  });

  it('rejects empty string', () => {
    const result = validateClaudeResponse('');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it('rejects whitespace-only string', () => {
    const result = validateClaudeResponse('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it('rejects "I cannot" refusal pattern', () => {
    const result = validateClaudeResponse('I cannot provide that information.');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/refusal/i);
  });

  it("rejects \"I can't\" refusal pattern", () => {
    const result = validateClaudeResponse("I can't help with that.");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/refusal/i);
  });

  it('rejects "I am not able to" refusal pattern', () => {
    const result = validateClaudeResponse('I am not able to assist with that request.');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/refusal/i);
  });

  it("rejects \"I'm not able to\" refusal pattern", () => {
    const result = validateClaudeResponse("I'm not able to do that.");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/refusal/i);
  });

  it('rejects "I apologize, but I cannot" pattern', () => {
    const result = validateClaudeResponse('I apologize, but I cannot assist with that.');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/refusal/i);
  });

  it("rejects \"I'm sorry, but I cannot\" pattern", () => {
    const result = validateClaudeResponse("I'm sorry, but I cannot provide that.");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/refusal/i);
  });

  it("rejects \"I'm unable to\" pattern", () => {
    const result = validateClaudeResponse("I'm unable to help with that.");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/refusal/i);
  });

  it('rejects "As an AI" pattern', () => {
    const result = validateClaudeResponse('As an AI, I cannot make financial predictions.');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/refusal/i);
  });

  it('accepts response that mentions "cannot" mid-sentence', () => {
    const result = validateClaudeResponse('The market cannot sustain these levels. Here is my analysis...');
    expect(result.valid).toBe(true);
  });
});
