# llm-guard

Lightweight secret scanning utility for LLM input/output.

## Install

```bash
npm install @stashbase/llm-guard
```

## Quick Start

```ts
import { initGuard, guard, scan } from '@stashbase/llm-guard'

initGuard({ apiKey: process.env.STASHBASE_API_KEY! })

// non-blocking (fire-and-forget)
await guard('User prompt text', {
  onResult: (res) => {
    if (res.hasSecret) {
      console.warn('Secret detected')
    }
  },
  onError: (err) => {
    console.error('Guard failed', err)
  },
})

// blocking (returns API-style response)
const result = await scan('Model output text')
if (result.ok && result.data?.hasSecret) {
  console.warn('Secret detected in output')
}
```

## Context Example

```ts
await guard('User prompt text', {
  context: { chatId: 'chat-123', userId: 42 },
  onResult: (res, ctx) => {
    if (res.hasSecret) {
      console.log('secret detected in chat', ctx?.chatId, 'for user', ctx?.userId)
    }
  },
  onError: (err, ctx) => {
    console.error('guard failed for', ctx?.chatId, err)
  },
})
```

## API

- `initGuard(config)`
  - Sets global API config.
- `guard(input, options?)`
  - Non-blocking scan.
  - Returns original input.
  - Supports callbacks (`onResult`, `onError`) and `sampleRate`.
- `scan(input, options?)`
  - Blocking scan.
  - Returns `{ ok, data, error }`.
- `flush()`
  - Waits for all in-flight `guard()` scans to settle.
- `extractTexts(input)`
  - Optional utility for normalizing common LLM message formats into `string[]`.

## Notes

- `guard` and `scan` both accept:
  - `string`
  - `string[]`
  - `() => string | string[] | Promise<string | string[]>`
- If using inline options (`apiKey`, `baseUrl`, etc.), global initialization is optional.

## Graceful Shutdown

```ts
import { flush } from '@stashbase/llm-guard'

process.on('SIGTERM', async () => {
  await flush()
  process.exit(0)
})
```
