# API.md — REST API Reference

[Home](README.md) > [Docs Index](DOCS.md) > API Reference

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Format](#error-format)
4. [Endpoints](#endpoints)
   - [GET /api/market/chart/\[ticker\]](#get-apimarketcharticker)
   - [GET /api/market/options-overlay](#get-apimarketoptions-overlay)
   - [GET /api/options/snapshot](#get-apioptionssnapshot)
   - [GET /api/options/projection](#get-apioptionsprojection)
   - [POST /api/options/ai-forecast](#post-apioptionsai-forecast)
   - [GET /api/fear-greed](#get-apifear-greed)
   - [GET /api/reports](#get-apireports)
   - [GET /api/reports/latest](#get-apireportslatest)
   - [GET /api/reports/\[date\]](#get-apireportsdate)
   - [POST /api/reports/generate](#post-apireportsgenerate)
5. [See Also](#see-also)

---

## Overview

All endpoints are Next.js App Router route handlers. Base URL in development: `http://localhost:3002` (see [DEV.md](DEV.md) for port allocation). Base URL in production: `http://localhost:3000` (internal only — no public domain).

Responses are JSON unless noted. All timestamps use ISO 8601 format (`YYYY-MM-DDTHH:MM:SSZ`) unless noted as Unix epoch seconds.

---

## Authentication

Most endpoints are **public** (no authentication required). The single exception is:

- `POST /api/reports/generate` — requires `Authorization: Bearer <REPORT_SECRET>` header, where `REPORT_SECRET` is set in `.env.local`.

---

## Error Format

All error responses follow this shape:

```json
{
  "error": "Human-readable error message"
}
```

Common HTTP status codes:
| Code | Meaning |
|---|---|
| `400` | Bad Request — invalid parameters |
| `401` | Unauthorized — missing/invalid auth token |
| `404` | Not Found — no data for requested params |
| `500` | Internal Server Error — unexpected failure |
| `502` | Bad Gateway — upstream API failure (CNN, Yahoo) |

---

## Endpoints

### GET /api/market/chart/[ticker]

Fetch historical price data for a market ticker. Proxies Yahoo Finance or FRED (Federal Reserve) depending on the ticker.

#### Supported Tickers

| Ticker | Name | Source |
|---|---|---|
| `^GSPC` | S&P 500 | Yahoo Finance |
| `^VIX` | VIX Volatility | Yahoo Finance |
| `DX-Y.NYB` | US Dollar Index | Yahoo Finance |
| `^TNX` | 10Y Treasury Yield | Yahoo Finance |
| `DGS2` | 2Y Treasury Yield | FRED |
| `DGS10` | 10Y Treasury Yield | FRED |
| `CL=F` | WTI Crude Oil | Yahoo Finance |
| `BZ=F` | Brent Crude Oil | Yahoo Finance |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `range` | string | No | none (7-day snapshot) | Time range: `1D`, `5D`, `1M`, `3M`, `6M`, `1Y`, `YTD` |

**Note:** When `range` is omitted, returns the last 7 data points. When `range=1D`, returns 5-minute intraday candles. FRED tickers (DGS2, DGS10) do not support `range=1D` — returns `{ data: [], unsupported: true }` for that combination.

#### Caching

| Range | Revalidate |
|---|---|
| `1D` | 60 seconds |
| All others | 900 seconds (15 min) |

#### Example Request

```bash
curl "http://localhost:3002/api/market/chart/%5EGSPC?range=1M"
```

#### Example Response

```json
{
  "symbol": "^GSPC",
  "name": "S&P 500",
  "points": [
    { "time": "2026-02-10", "value": 5980.23 },
    { "time": "2026-02-11", "value": 6002.45 },
    { "time": "2026-03-10", "value": 5745.12 }
  ],
  "current": 5745.12,
  "open": 5980.23,
  "change": -235.11,
  "changePct": -3.93
}
```

#### Error Codes

| Status | Error | Cause |
|---|---|---|
| `400` | `"Invalid range"` | `range` param not in allowed list |
| `500` | `"No data available"` | Zero data points returned from upstream |
| `500` | `"Yahoo Finance fetch failed: <status>"` | Upstream API failure |

---

### GET /api/market/options-overlay

Fetch option price history alongside underlying price history, for rendering an overlay chart. Data comes from the local SQLite database (`option_prices` table).

#### Query Parameters

| Parameter | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `ticker` | string | Yes | — | One of: `SPX`, `SPY`, `QQQ`, `IWM`, `DIA` |
| `strike` | number | Yes | — | Positive, max 10000 |
| `expiry` | string | Yes | — | Format: `YYYY-MM-DD` |
| `optionType` | string | No | `call` | `call` or `put` |
| `range` | string | No | `1D` | `1D`, `5D`, `1M`, `3M`, `6M`, `1Y` |

#### Caching

| Range | Cache-Control |
|---|---|
| `1D` | `max-age=60, stale-while-revalidate=300` |
| `5D` | `max-age=300, stale-while-revalidate=1800` |
| Others | `max-age=900, stale-while-revalidate=3600` |

#### Example Request

```bash
curl "http://localhost:3002/api/market/options-overlay?ticker=SPY&strike=550&expiry=2026-06-20&optionType=call&range=1M"
```

#### Example Response

```json
{
  "ticker": "SPY",
  "strike": 550,
  "expiry": "2026-06-20",
  "optionType": "call",
  "range": "1M",
  "points": [
    {
      "time": "2026-02-10T15:00:00.000Z",
      "underlyingPrice": 548.32,
      "optionPrice": 12.45
    }
  ],
  "current": {
    "underlying": 548.32,
    "option": 12.45
  },
  "metadata": {
    "dataAvailability": "full",
    "earliestTimestamp": "2026-02-10T15:00:00.000Z"
  }
}
```

#### Error Codes

| Status | Error | Cause |
|---|---|---|
| `400` | `"Invalid or missing ticker"` | ticker not in allowed list |
| `400` | `"Invalid strike price"` | Strike ≤ 0 or > 10000 |
| `400` | `"Invalid expiry date format (use YYYY-MM-DD)"` | Wrong date format |
| `404` | `"No option price data available..."` | No rows in `option_prices` for params |
| `404` | `"No matching data points..."` | Underlying and option timestamps don't align |

---

### GET /api/options/snapshot

Retrieve the most recent options analytics snapshot for a ticker/expiry combination. Returns implied volatility, Greeks, skew, and implied move data from the `option_snapshots` table.

#### Query Parameters

| Parameter | Type | Required | Default |
|---|---|---|---|
| `ticker` | string | No | `SPWX` |
| `expiry` | string | No | `30d` |

#### Example Request

```bash
curl "http://localhost:3002/api/options/snapshot?ticker=SPWX&expiry=30d"
```

#### Example Response

```json
{
  "ticker": "SPWX",
  "timestamp": "2026-03-11T14:00:00.000Z",
  "expirations": ["1w", "30d", "60d"],
  "volatility": {
    "iv_30d": 18.5,
    "iv_60d": 19.2,
    "hv_20d": 15.3,
    "hv_60d": 14.8,
    "iv_rank": 42,
    "iv_percentile": 0.42
  },
  "greeks": {
    "net_delta": 0.52,
    "atm_gamma": 0.031,
    "vega_per_1pct": 2.14,
    "theta_daily": -0.085
  },
  "skew": {
    "call_otm_iv_25d": 16.2,
    "put_otm_iv_25d": 21.4,
    "skew_ratio": 1.32,
    "skew_direction": "put_heavy"
  },
  "implied_move": {
    "1w_move_pct": 1.2,
    "30d_move_pct": 2.4,
    "1w_conf_low": 469.3,
    "1w_conf_high": 480.8,
    "2sd_low": 463.6,
    "2sd_high": 486.4
  },
  "regime": "normal"
}
```

#### Error Codes

| Status | Error | Cause |
|---|---|---|
| `404` | `"No data available for this ticker/expiry"` | No snapshot in DB |
| `500` | `"Internal server error"` | DB or parse error |

---

### GET /api/options/projection

Retrieve probability distribution projections and key price levels for a ticker. Looks up the latest snapshot date, then returns the corresponding projection for the given horizon.

#### Query Parameters

| Parameter | Type | Required | Default |
|---|---|---|---|
| `ticker` | string | No | `SPWX` |
| `horizonDays` | integer | No | `30` |

#### Example Request

```bash
curl "http://localhost:3002/api/options/projection?ticker=SPWX&horizonDays=28"
```

#### Example Response

```json
{
  "ticker": "SPWX",
  "date": "2026-03-11",
  "expiry_horizon": 28,
  "prob_distribution": [
    { "price": 450, "probability": 0.02 },
    { "price": 475, "probability": 0.18 },
    { "price": 500, "probability": 0.35 },
    { "price": 525, "probability": 0.28 }
  ],
  "keyLevels": [
    { "level": 490, "type": "support", "probability": 0.72 },
    { "level": 520, "type": "resistance", "probability": 0.61 }
  ],
  "regimeTransition": {
    "from": "normal",
    "to": "elevated",
    "confidence": 0.75
  }
}
```

#### Error Codes

| Status | Error | Cause |
|---|---|---|
| `404` | `"No snapshot data available"` | No option_snapshots row for ticker |
| `404` | `"No projection data available"` | No matching projection in DB |
| `500` | `"Internal server error"` | DB error |

---

### POST /api/options/ai-forecast

Generate or retrieve a cached AI-powered options analysis using Claude. Analyzes current snapshot + projection data and returns a structured outlook with price targets, key levels, and regime analysis.

**Note:** This endpoint is `POST` because it may trigger an AI generation request, which is not idempotent.

#### Request Body

```json
{
  "ticker": "SPWX",
  "date": "2026-03-11",
  "regenerate": false
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `ticker` | string | Yes | Options ticker |
| `date` | string | Yes | Date in `YYYY-MM-DD` format |
| `regenerate` | boolean | No (default: `false`) | Force re-generation bypassing cache |

#### Example Request

```bash
curl -X POST http://localhost:3002/api/options/ai-forecast \
  -H "Content-Type: application/json" \
  -d '{"ticker":"SPWX","date":"2026-03-11","regenerate":false}'
```

#### Example Response

```json
{
  "success": true,
  "analysis": {
    "summary": "Volatility is elevated relative to historical norms...",
    "outlook": "neutral",
    "pricetargets": {
      "conservative": 485,
      "base": 500,
      "aggressive": 520,
      "confidence": 0.72
    },
    "regime": {
      "classification": "elevated",
      "justification": "IV rank at 42 with put-heavy skew...",
      "recommendation": "Favor defined-risk spreads..."
    },
    "keyLevels": {
      "support": 490,
      "resistance": 518,
      "profitTargets": [505, 515],
      "stopLoss": 483
    },
    "confidence": {
      "overall": 0.68,
      "reasoning": "Moderate confidence due to mixed signals..."
    }
  },
  "cached": true,
  "cacheAge": 3842,
  "nextUpdate": "2026-03-11T18:00:00.000Z"
}
```

#### Error Codes

| Status | Error | Cause |
|---|---|---|
| `400` | `"Missing ticker or date"` | Required fields absent |
| `400` | `"No data available for <ticker> on <date>"` | No snapshot/projection in DB |
| `500` | `"Internal server error"` | Claude API or DB failure |

---

### GET /api/fear-greed

Proxy for the CNN Money Fear & Greed Index. Returns current score and historical comparisons.

**Caching:** Fetched from CNN with `revalidate: 900` (15 min). Route-level caching is intentionally disabled to avoid caching error responses.

#### Example Request

```bash
curl "http://localhost:3002/api/fear-greed"
```

#### Example Response

```json
{
  "score": 34,
  "rating": "Fear",
  "previousClose": 38,
  "previous1Week": 52,
  "previous1Month": 61,
  "previous1Year": 70,
  "timestamp": "2026-03-11T14:30:00Z"
}
```

#### Score Ratings

| Score Range | Rating |
|---|---|
| 0–24 | Extreme Fear |
| 25–44 | Fear |
| 45–55 | Neutral |
| 56–74 | Greed |
| 75–100 | Extreme Greed |

#### Error Codes

| Status | Error | Cause |
|---|---|---|
| `502` | `"CNN API returned <status>"` | Upstream CNN API failure |

---

### GET /api/reports

List all available market reports, ordered by most recently generated first.

#### Example Request

```bash
curl "http://localhost:3002/api/reports"
```

#### Example Response

```json
[
  {
    "id": 42,
    "date": "2026-03-11",
    "period": "eod",
    "generated_at": 1741694400,
    "model": "claude-sonnet-4-5"
  },
  {
    "id": 41,
    "date": "2026-03-11",
    "period": "morning",
    "generated_at": 1741665600,
    "model": "claude-sonnet-4-5"
  }
]
```

**Note:** Returns at most 50 reports (hard-coded `LIMIT`). `generated_at` is a Unix timestamp (seconds since epoch).

---

### GET /api/reports/latest

Retrieve the full content of the most recently generated report.

#### Example Request

```bash
curl "http://localhost:3002/api/reports/latest"
```

#### Example Response

```json
{
  "id": 42,
  "date": "2026-03-11",
  "period": "eod",
  "generatedAt": 1741694400,
  "model": "claude-sonnet-4-5",
  "marketData": {
    "spx": { "symbol": "^GSPC", "current": 5745.12, "changePct": -1.23 },
    "vix": { "symbol": "^VIX", "current": 22.4, "changePct": 8.5 }
  },
  "analysis": {
    "summary": "Markets sold off sharply on...",
    "outlook": "cautious",
    "keyThemes": ["Fed uncertainty", "Tech weakness"],
    "sectors": {}
  }
}
```

#### Error Codes

| Status | Error | Cause |
|---|---|---|
| `404` | `"No report available yet"` | Database is empty |

---

### GET /api/reports/[date]

Retrieve a specific report by date. Optionally filter by period (morning/midday/eod). If no `period` is specified, returns the most recently generated report for that date.

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `date` | string | Date in `YYYY-MM-DD` format |

#### Query Parameters

| Parameter | Type | Required | Values |
|---|---|---|---|
| `period` | string | No | `morning`, `midday`, `eod` |

#### Example Requests

```bash
# Get any report for March 11
curl "http://localhost:3002/api/reports/2026-03-11"

# Get the morning report specifically
curl "http://localhost:3002/api/reports/2026-03-11?period=morning"
```

#### Example Response

Same shape as `/api/reports/latest`.

#### Error Codes

| Status | Error | Cause |
|---|---|---|
| `400` | `"Invalid date format"` | Date not matching `YYYY-MM-DD` |
| `404` | `"Report not found"` | No report for that date/period |

---

### POST /api/reports/generate

Trigger generation of a new market report. Fetches live market data, sends it to Claude for analysis, and stores the result in the database.

**Authentication required:** `Authorization: Bearer <REPORT_SECRET>`

The `REPORT_SECRET` environment variable must be set in `.env.local`.

#### Request Body (optional)

```json
{
  "period": "eod"
}
```

| Field | Type | Required | Values | Default |
|---|---|---|---|---|
| `period` | string | No | `morning`, `midday`, `eod` | `eod` |

#### Example Request

```bash
curl -X POST http://localhost:3002/api/reports/generate \
  -H "Authorization: Bearer your-secret-here" \
  -H "Content-Type: application/json" \
  -d '{"period":"eod"}'
```

#### Example Response (201 Created)

```json
{
  "success": true,
  "date": "2026-03-11",
  "period": "eod",
  "id": 43
}
```

#### Error Codes

| Status | Error | Cause |
|---|---|---|
| `401` | `"Unauthorized"` | Missing or wrong `Authorization` header |
| `500` | `"<error message>"` | Market data fetch or Claude API failure |

**Note:** Generating a report for a date/period that already exists will **overwrite** the existing report (uses `INSERT OR REPLACE`).

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — How routes are structured
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Debugging API errors
- [DATABASE.md](DATABASE.md) — Understanding the underlying data schema
