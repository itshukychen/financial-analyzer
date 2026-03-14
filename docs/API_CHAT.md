# Report Chat Widget API

## Overview

The Report Chat Widget provides interactive Q&A functionality for market reports. Users can ask questions about a specific report and receive AI-generated answers based on the report content.

## Endpoints

### POST `/api/reports/[reportId]/ask`

Ask a question about a specific report.

#### Request

**URL Parameters:**
- `reportId` (string, required) - Format: `YYYY-MM-DD` or `YYYY-MM-DD-period`
  - Examples: `2026-03-14`, `2026-03-14-morning`, `2026-03-14-eod`
  - Period values: `morning`, `midday`, `eod`

**Request Body:**
```json
{
  "question": "What is the market outlook?"
}
```

**Headers:**
- `Content-Type: application/json`

#### Response

**Success (200):**
```json
{
  "answer": "The market shows a bullish bias with technical support at 5730...",
  "tokensUsed": {
    "input": 850,
    "output": 150
  }
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | `Invalid reportId format` | reportId doesn't match expected format |
| 400 | `Question is required and must be a string` | Missing or invalid question field |
| 400 | `Question cannot be empty` | Question is empty or whitespace only |
| 400 | `Question too long (max 500 characters)` | Question exceeds 500 character limit |
| 404 | `Report not found for the specified date and period` | Report doesn't exist in database |
| 500 | Error message | Internal server error (check logs) |
| 502 | `Request timeout` | API call to Claude took longer than 10 seconds |

#### Rate Limiting

- Client-side: 30 questions per session (stored in `sessionStorage`)
- Server-side: No rate limit (uses Anthropic API quotas)

#### Example Usage

```typescript
// Frontend component
const response = await fetch('/api/reports/2026-03-14-morning/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'What is the VIX level?' }),
});

const data = await response.json();
console.log(data.answer);
```

## Implementation Details

### Database

Questions are logged to the `question_logs` table:

```sql
CREATE TABLE question_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id     TEXT    NOT NULL,
  question      TEXT    NOT NULL,
  answer        TEXT    NOT NULL,
  tokens_input  INTEGER,
  tokens_output INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
```

### AI Prompt

The prompt includes:
- Report date, period, and generation time
- Full market data snapshot (tickers, prices, indicators)
- All analysis sections (equity diagnosis, volatility, etc.)
- Regime probability classifications

Users are instructed to answer based only on report content and keep responses under 200 words.

### Token Usage

Token counts are provided by the Claude API and logged for analytics:
- `tokens_input`: Tokens used for the full prompt (including report context)
- `tokens_output`: Tokens used for the answer

## Configuration

### Environment Variables

- `ANTHROPIC_API_KEY` (required) - Claude API key from anthropic.com

### Model & Settings

- **Model**: `claude-3-5-sonnet-20241022`
- **Max Tokens**: 500
- **Temperature**: 0.7
- **Timeout**: 10 seconds

## Security

- Questions are validated for length (max 500 chars)
- Report IDs are validated before querying the database
- No external API calls except to Anthropic
- Session-based rate limiting prevents abuse from single clients

## Monitoring

### Logs

Check server logs for:
- `[Report Q&A API] Error:` - API endpoint errors
- `[Report Q&A] Claude API call failed:` - AI service errors
- `[Question Logs] Insert failed:` - Database errors

### Analytics

Questions are logged in the database and can be queried:

```sql
SELECT report_id, COUNT(*) as question_count, 
       SUM(tokens_input) as total_input_tokens
FROM question_logs
GROUP BY report_id
ORDER BY created_at DESC;
```

## Troubleshooting

### "ANTHROPIC_API_KEY not configured"
- Ensure `ANTHROPIC_API_KEY` environment variable is set
- Check `.env.local` file exists and has correct API key

### "Request timeout - API took too long to respond"
- Claude API is slow (>10s response time)
- Check Anthropic service status
- May need to increase timeout or use faster model

### "Report not found"
- Date format may be incorrect (use `YYYY-MM-DD`)
- Report may not be generated yet for that date
- Check if period parameter is needed (`-morning`, `-midday`, `-eod`)

### "Gateway timeout" (502)
- Request was aborted due to 10-second timeout
- Claude API is experiencing slowness
- Try again in a few seconds

## Future Enhancements

- [ ] Multi-turn conversation support (maintain context across questions)
- [ ] Server-side rate limiting per IP address
- [ ] Custom system prompts per report type
- [ ] Response caching for identical questions
- [ ] Streaming responses for faster feedback
- [ ] Analytics dashboard for question/answer insights
