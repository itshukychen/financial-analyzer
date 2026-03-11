/**
 * Message validation and sanitization utilities for the Claude chat feature.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const MAX_MESSAGE_LENGTH = 5000;

const REFUSAL_PATTERNS = [
  "I cannot",
  "I can't",
  "I am not able to",
  "I'm not able to",
  "I apologize, but I cannot",
  "I'm sorry, but I cannot",
  "I'm unable to",
  "I am unable to",
  "As an AI, I cannot",
  "As an AI language model",
];

/**
 * Validates a user message for length, content, and type correctness.
 */
export function validateUserMessage(message: unknown): ValidationResult {
  if (typeof message !== "string") {
    return { valid: false, error: "Message must be a string" };
  }

  if (message.trim().length === 0) {
    return { valid: false, error: "Message cannot be empty" };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
    };
  }

  return { valid: true };
}

/**
 * Removes XSS vectors from a message string.
 * Strips script tags, iframes, javascript: URLs, and inline event handlers.
 */
export function sanitizeMessage(message: string): string {
  let sanitized = message;

  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove iframe tags and their content
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");

  // Remove all remaining HTML tags that could be dangerous
  // Remove tags with event handlers (on*)
  sanitized = sanitized.replace(/<[^>]*\bon\w+\s*=[^>]*>/gi, "");

  // Remove javascript: URLs in href/src/action attributes
  sanitized = sanitized.replace(/\bhref\s*=\s*["']?\s*javascript\s*:[^"'\s>]*/gi, 'href="#"');
  sanitized = sanitized.replace(/\bsrc\s*=\s*["']?\s*javascript\s*:[^"'\s>]*/gi, 'src=""');
  sanitized = sanitized.replace(/\baction\s*=\s*["']?\s*javascript\s*:[^"'\s>]*/gi, 'action=""');

  // Remove any remaining standalone javascript: protocol references
  sanitized = sanitized.replace(/javascript\s*:/gi, "");

  return sanitized;
}

/**
 * Generates a conversation title from the first user message.
 * Truncates to 60 characters, preferring to use a question if one is present.
 */
export function generateTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();

  // Look for a question in the message (sentence ending with ?)
  const questionMatch = trimmed.match(/([^.!?\n]+\?)/);
  const candidate = questionMatch ? questionMatch[1].trim() : trimmed;

  if (candidate.length <= 60) {
    return candidate;
  }

  // Truncate to 60 chars, try to cut at a word boundary
  const truncated = candidate.substring(0, 60);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > 40) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
}

/**
 * Validates a Claude API response for empty content or known refusal patterns.
 */
export function validateClaudeResponse(response: unknown): ValidationResult {
  if (typeof response !== "string") {
    return { valid: false, error: "Response must be a string" };
  }

  if (response.trim().length === 0) {
    return { valid: false, error: "Response is empty" };
  }

  for (const pattern of REFUSAL_PATTERNS) {
    if (response.startsWith(pattern)) {
      return { valid: false, error: `Response matches refusal pattern: "${pattern}"` };
    }
  }

  return { valid: true };
}
