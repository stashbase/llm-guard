# llm-guard

Prevent accidental secret leakage to LLMs.

`@stashbase/llm-guard` scans LLM prompts, completions, and structured text payloads for secrets before they leave your app or reach a user. 
It helps catch accidental exposure of API keys, access tokens, passwords, and other credentials in prompts, completions, tool calls, and other runtime AI workflows.

Scanning is performed by the Stashbase hosted detection API, so detection logic can be continuously updated without requiring package updates in your application. Depending on the content being scanned, findings may include secrets such as OpenAI, Stripe, AWS, GitHub, Supabase, or Slack credentials.

Part of the [Stashbase](https://stashbase.dev) platform.

## Install

```bash
npm install @stashbase/llm-guard
```

You need a Stashbase API key to scan text.

Text is securely sent to the Stashbase scanning API over HTTPS. See [Stashbase](https://stashbase.dev) for security details.

## Quick Start

```ts
import { initGuard, guard, scan } from '@stashbase/llm-guard'

initGuard({ apiKey: process.env.STASHBASE_API_KEY! })

const result = await scan('Model output text')

if (!result.ok) {
  console.error('Scan failed', result.error)
} else if (result.data?.hasSecret) {
  console.warn('Secret detected')
}
```

Use `scan()` as the enforcement API when a possible secret leak must be prevented before continuing. `scan()` waits for the Stashbase scan result, so it fits decision points such as checking a prompt before sending it to an LLM or checking output before returning it to a user.

Use `guard()` as the monitoring API when you want detection without adding request latency. `guard()` immediately returns the original input, performs scanning in the background, and reports findings through callbacks. It fits monitoring, alerting, logging, and analytics workflows.

```ts
guard('User prompt text', {
  onResult: (res) => {
    if (res.hasSecret) {
      console.warn('Secret detected')
    }
  },
  onError: (err) => {
    console.error('Guard failed', err)
  },
})
```

## OpenAI Example

```ts
import OpenAI from 'openai'
import { guard, scan } from '@stashbase/llm-guard'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const userPrompt = 'Summarize this document'
const promptCheck = await scan(userPrompt, {
  apiKey: process.env.STASHBASE_API_KEY!,
})

if (promptCheck.ok && promptCheck.data?.hasSecret) {
  throw new Error('Prompt contains a secret')
}

const response = await openai.responses.create({
  model: 'gpt-4o-mini',
  input: userPrompt,
})

const output = response.output_text

await guard(output, {
  apiKey: process.env.STASHBASE_API_KEY!,
  onResult: (result) => {
    if (result.hasSecret) {
      console.warn('Model output may contain a secret')
    }
  },
})
```

## Common Use Cases

Use this package when you want to:

- use `scan()` to prevent a prompt containing secrets from being sent to an LLM
- use `scan()` to prevent model output containing secrets from being returned to a user
- use `guard()` to monitor prompts or completions in the background for alerting or audit logs
- use `guard()` to add detection to production traffic where extra request latency is undesirable
- scan structured payloads such as chat messages or tool results with `scanAny()` or `guardAny()`

## Context Example

```ts
guard('User prompt text', {
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
  - Monitoring API for `string` or `string[]`.
  - Returns original input immediately and scans in the background.
  - Supports callbacks (`onResult`, `onError`) and `sampleRate`.
- `scan(input, options?)`
  - Enforcement API for `string` or `string[]`.
  - Waits for the scan result before returning `{ ok, data, error }`.
- `guardAny(input, options?)`
  - Monitoring API for nested JSON-like payloads.
  - Extracts non-empty string values from arrays and objects before scanning.
  - Returns original input immediately and scans in the background.
- `scanAny(input, options?)`
  - Enforcement API for nested JSON-like payloads.
  - Extracts non-empty string values from arrays and objects before scanning.
  - Waits for the scan result before returning `{ ok, data, error }`.
- `flush()`
  - Waits for all in-flight `guard()` scans to settle.

## Notes

- `guard` and `scan` accept:
  - `string`
  - `string[]`
  - `() => string | string[] | Promise<string | string[]>`
- `guardAny` and `scanAny` accept:
  - nested arrays and objects containing string values
  - resolver functions returning nested arrays or objects
- If using inline options (`apiKey`, `baseUrl`, etc.), global initialization is optional.

## Graceful Shutdown

```ts
import { flush } from '@stashbase/llm-guard'

process.on('SIGTERM', async () => {
  await flush()
  process.exit(0)
})
```

## Auto-normalized Input Helpers

```ts
import { guardAny, scanAny } from '@stashbase/llm-guard'

const messages = [
  { role: 'user', content: 'hello' },
  { role: 'assistant', content: [{ type: 'text', text: 'world' }] },
]

guardAny(messages, {
  onResult: () => {},
})
const res = await scanAny(messages)
```

`guardAny()` and `scanAny()` recursively extract non-empty string values. For the example above, the scanned text array is effectively:

```ts
['user', 'hello', 'assistant', 'text', 'world']
```
