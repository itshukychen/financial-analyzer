import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  RateLimitError,
  APIError,
} from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages';

// ─── Environment validation ────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is not set. ' +
        'Please set it before starting the application.'
    );
  }
  return key;
}

// ─── Public types ──────────────────────────────────────────────────────────

export interface StreamMessageOptions {
  systemPrompt: string;
  messages: MessageParam[];
  model?: string;
  maxTokens?: number;
  onDelta: (text: string) => void;
  onComplete: (fullText: string, inputTokens: number, outputTokens: number) => void;
  onError?: (error: ChatError) => void;
  signal?: AbortSignal;
}

export interface ChatError {
  code: 'auth' | 'rate_limit' | 'timeout' | 'connection' | 'api' | 'unknown';
  message: string;
  retryAfterMs?: number;
}

// ─── Singleton client ──────────────────────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: getApiKey() });
  }
  return _client;
}

// ─── Error normalizer ──────────────────────────────────────────────────────

function normalizeChatError(err: unknown): ChatError {
  if (err instanceof AuthenticationError) {
    return { code: 'auth', message: 'Invalid or missing API key.' };
  }
  if (err instanceof RateLimitError) {
    const retryAfter = (err as APIError & { headers?: Record<string, string> }).headers?.[
      'retry-after'
    ];
    const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000;
    return {
      code: 'rate_limit',
      message: 'Rate limit exceeded. Please wait before sending another message.',
      retryAfterMs,
    };
  }
  if (err instanceof APIConnectionTimeoutError) {
    return { code: 'timeout', message: 'Request timed out. Please try again.' };
  }
  if (err instanceof APIConnectionError) {
    return { code: 'connection', message: 'Unable to reach Claude API. Check your connection.' };
  }
  if (err instanceof APIError) {
    return {
      code: 'api',
      message: `Claude API error (${(err as APIError).status ?? 'unknown'}): ${err.message}`,
    };
  }
  if (err instanceof Error) {
    return { code: 'unknown', message: err.message };
  }
  return { code: 'unknown', message: String(err) };
}

// ─── streamMessage ─────────────────────────────────────────────────────────

/**
 * Streams a message to Claude and delivers content via callbacks.
 *
 * @param options.systemPrompt  - System prompt providing context for Claude
 * @param options.messages      - Prior conversation history
 * @param options.model         - Claude model ID (defaults to claude-sonnet-4-6)
 * @param options.maxTokens     - Max tokens in response (defaults to 4096)
 * @param options.onDelta       - Called on each streamed text chunk
 * @param options.onComplete    - Called once streaming finishes, with full text + token counts
 * @param options.onError       - Called on any error; if omitted, error is thrown
 * @param options.signal        - AbortSignal to cancel the stream
 */
export async function streamMessage(options: StreamMessageOptions): Promise<void> {
  const {
    systemPrompt,
    messages,
    model = 'claude-sonnet-4-6',
    maxTokens = 4096,
    onDelta,
    onComplete,
    onError,
    signal,
  } = options;

  const client = getClient();

  try {
    const stream = client.messages.stream(
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      },
      { signal }
    );

    let fullText = '';

    stream.on('text', (text) => {
      fullText += text;
      onDelta(text);
    });

    const finalMessage = await stream.finalMessage();
    const inputTokens = finalMessage.usage.input_tokens;
    const outputTokens = finalMessage.usage.output_tokens;

    onComplete(fullText, inputTokens, outputTokens);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      // Request was intentionally cancelled — not an error condition
      return;
    }
    const chatError = normalizeChatError(err);
    if (onError) {
      onError(chatError);
    } else {
      throw chatError;
    }
  }
}

// ─── validateApiKey ────────────────────────────────────────────────────────

/**
 * Tests API connectivity by sending a minimal request to Claude.
 * Returns true if the key is valid and the API is reachable, false otherwise.
 */
export async function validateApiKey(): Promise<boolean> {
  try {
    const client = getClient();
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });
    return true;
  } catch (err) {
    if (err instanceof AuthenticationError) return false;
    if (err instanceof APIConnectionError) return false;
    if (err instanceof APIConnectionTimeoutError) return false;
    // Rate limit etc. — key itself is valid
    if (err instanceof RateLimitError) return true;
    return false;
  }
}
