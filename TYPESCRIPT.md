# TYPESCRIPT.md — TypeScript Configuration & Conventions

[Home](README.md) > [Docs Index](DOCS.md) > TypeScript

## Table of Contents

1. [tsconfig.json Settings](#tsconfigjson-settings)
2. [Core Conventions](#core-conventions)
3. [Common Patterns](#common-patterns)
4. [IDE Setup](#ide-setup)
5. [Debugging TypeScript Errors](#debugging-typescript-errors)
6. [See Also](#see-also)

---

## tsconfig.json Settings

```json
{
  "compilerOptions": {
    "target": "ES2017",           // Compile to ES2017 for broad Node.js compat
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,              // Allow .js files alongside .ts
    "skipLibCheck": true,         // Skip type-checking of node_modules
    "strict": true,               // ← All strict checks enabled (see below)
    "noEmit": true,               // Next.js handles compilation; tsc only type-checks
    "esModuleInterop": true,      // Allows: import fs from 'fs' (not require)
    "module": "esnext",
    "moduleResolution": "bundler", // Matches Next.js/webpack module resolution
    "resolveJsonModule": true,    // Allows: import config from './config.json'
    "isolatedModules": true,      // Each file is independently compilable (Next.js requirement)
    "jsx": "react-jsx",
    "incremental": true,          // Speeds up repeated type checks
    "paths": {
      "@/*": ["./*"]              // Path alias: @/lib/db → ./lib/db
    }
  }
}
```

### What `"strict": true` Enables

| Flag | Effect |
|---|---|
| `strictNullChecks` | `null` and `undefined` are not assignable to other types |
| `strictFunctionTypes` | Strict checking of function parameter types |
| `strictPropertyInitialization` | Class properties must be initialized in constructor |
| `noImplicitAny` | Variables cannot implicitly be `any` |
| `noImplicitThis` | `this` must be explicitly typed in functions |

The most impactful for this codebase: **`strictNullChecks`** — every `null` return from the database or API must be handled explicitly.

---

## Core Conventions

### 1. Never Use `any`

`any` disables type checking for a value. Use `unknown` instead and narrow with type guards.

```typescript
// BAD — loses all type safety
function parseResponse(data: any) {
  return data.result.items;  // No error even if 'items' doesn't exist
}

// GOOD — unknown forces you to check the type first
function parseResponse(data: unknown): string[] {
  if (!data || typeof data !== 'object') throw new Error('Invalid response');
  const obj = data as { result?: { items?: string[] } };
  return obj.result?.items ?? [];
}
```

The only acceptable use of `any` is in `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a comment explaining why.

### 2. Always Specify Function Return Types

Explicit return types make function contracts self-documenting and catch bugs when refactoring.

```typescript
// BAD — return type inferred, easy to accidentally change
function getReport(id: number) {
  return db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
}

// GOOD — explicit return type
function getReport(id: number): ReportRow | null {
  return db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow | null;
}
```

### 3. `interface` for Public APIs, `type` for Internal Shapes

```typescript
// Use interface for: DB rows, API response shapes, component props
// (interfaces are extendable and produce better error messages)
export interface ReportRow {
  id: number;
  date: string;
  period: ReportPeriod;
  generated_at: number;
  ticker_data: string;
  report_json: string;
  model: string;
}

// Use type for: unions, mapped types, aliases
export type ReportPeriod = 'morning' | 'midday' | 'eod';
export type VolatilityRegime = 'low' | 'normal' | 'high';
```

### 4. Handle Null/Undefined from DB Queries

`better-sqlite3` `.get()` returns `unknown | undefined`, not `null`. Always cast and handle both:

```typescript
// BAD
const row = db.prepare('SELECT * FROM reports LIMIT 1').get();
console.log(row.date);  // TypeScript error: 'row' is possibly 'undefined'

// GOOD
const row = db.prepare('SELECT * FROM reports LIMIT 1').get() as ReportRow | undefined;
if (!row) return null;
console.log(row.date);  // Safe
```

### 5. Prefer `const` Over `let`

Use `const` for all values that don't need reassignment. Reserve `let` for loop variables and values that genuinely change.

```typescript
// BAD
let url = `https://api.example.com/${ticker}`;

// GOOD
const url = `https://api.example.com/${ticker}`;
```

---

## Common Patterns

### API Response Wrapper Types

```typescript
// Standard API success response wrapper
interface ApiResponse<T> {
  data: T;
  success: true;
}

// Standard API error response
interface ApiError {
  error: string;
  success: false;
}

type ApiResult<T> = ApiResponse<T> | ApiError;
```

### Database Row Interfaces

Always define interfaces for every table, matching the schema exactly:

```typescript
export interface OptionPrice {
  id: number;
  ticker: string;
  strike: number;
  expiry_date: string;
  option_type: 'call' | 'put';
  timestamp: number;
  price: number;
  bid: number | null;    // SQLite REAL nullable → TypeScript number | null
  ask: number | null;
  volume: number | null;
  created_at: number;
}
```

Use `Omit<OptionPrice, 'id' | 'created_at'>` for insert functions where auto-generated fields aren't provided.

### Component Props Interfaces

```typescript
// Define props interface immediately before the component
interface MarketChartProps {
  ticker: string;
  range?: '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | 'YTD';
  height?: number;
  onRangeChange?: (range: string) => void;
}

export function MarketChart({ ticker, range = '1D', height = 300, onRangeChange }: MarketChartProps) {
  // ...
}
```

---

## IDE Setup

### VSCode (Recommended)

Install these extensions:
- **TypeScript and JavaScript Language Features** (built-in — ensure it's using the workspace TypeScript version)
- **ESLint** (`dbaeumer.vscode-eslint`)
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
- **Error Lens** (`usernamehw.errorlens`) — shows TypeScript errors inline

Recommended `.vscode/settings.json`:
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "shortest",
  "tailwindCSS.experimental.classRegex": [
    ["className\\s*=\\s*['\"`]([^'\"\\`]*)['\"`]"]
  ]
}
```

Verify TypeScript version in VSCode: open a `.ts` file → click the TypeScript version in the status bar → "Select TypeScript Version" → "Use Workspace Version".

---

## Debugging TypeScript Errors

### "Property X does not exist on type Y"

```typescript
// Error:
// Property 'items' does not exist on type 'object'
const items = response.items; // BAD

// Fix: check the actual type or cast with assertion
interface ResponseShape {
  items: string[];
}
const typed = response as ResponseShape;
const items = typed.items;  // OK

// Or use optional chaining if the field might not exist
const items = (response as ResponseShape)?.items ?? [];
```

### "Type X is not assignable to type Y"

```typescript
// Error:
// Type 'string | null' is not assignable to parameter of type 'string'
function process(s: string) { ... }
process(searchParams.get('name')); // BAD — get() returns string | null

// Fix 1: Early return
const name = searchParams.get('name');
if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });
process(name); // TypeScript knows name is string here

// Fix 2: Non-null assertion (only when you're certain it exists)
process(searchParams.get('name')!); // ! tells TypeScript: "trust me, not null"
```

### "Object is possibly undefined"

```typescript
// Error:
// Object is possibly 'undefined'
const first = array[0].value; // BAD — array[0] might be undefined

// Fix: Check before accessing
const first = array[0];
if (!first) throw new Error('Empty array');
const value = first.value; // Safe

// Or use optional chaining
const value = array[0]?.value ?? 0;
```

### Run Type Check

```bash
# Full type check, no output files
npx tsc --noEmit

# Check a single file's types
npx tsc --noEmit --strict lib/db.ts
```

---

## See Also

- [CONTRIBUTING.md](CONTRIBUTING.md) — Code standards and PR process
- [ARCHITECTURE.md](ARCHITECTURE.md) — Where TypeScript types live in the project
