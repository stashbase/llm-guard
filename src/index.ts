import { HttpClient } from './http/client'
import { ApiResponse } from './http/response'
export { extractTexts } from './normalize'

const NOT_INITIALIZED_ERROR =
  'llm-guard not initialized. Call initGuard({ apiKey }) or pass apiKey in options.'

// --- types ---
export type ScanFinding = {
  textIndex: number
  category: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  preview: string
  valueSha256: string
  range: {
    startLine: number
    endLine: number
  }
}

export type ScanResult = {
  hasSecret: boolean
  findings: ScanFinding[]
}

type ScanTextApiResponse = {
  has_secret?: boolean
  findings: Array<{
    text_index: number
    category: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    preview: string
    value_sha256: string
    range: {
      start_line: number
      end_line: number
    }
  }>
}

export type GuardOptions<TContext = Record<string, unknown>> = {
  ignoreHashes?: string[]
  onResult?: (res: ScanResult, context: TContext | undefined) => void
  onError?: (error: unknown, context: TContext | undefined) => void
  context?: TContext
  sampleRate?: number // value between 0 and 1, default = 1
  apiKey?: string
  baseUrl?: string
  timeoutMs?: number
  retries?: number
}

// --- internal config ---
type GuardConfig = {
  apiKey: string
  enabled?: boolean
  sampleRate?: number
  baseUrl?: string
  timeoutMs?: number
  retries?: number
}

let config: GuardConfig | null = null
let client: HttpClient | null = null
const pendingScans = new Set<Promise<void>>()

/**
 * Initializes global SDK configuration used by `guard` and `scan`.
 *
 * @param input - Global configuration with API key and optional defaults.
 */
export function initGuard(input: GuardConfig) {
  config = input
  client = new HttpClient({
    baseUrl: input.baseUrl,
    timeoutMs: input.timeoutMs,
    retries: input.retries,
    authorization: {
      apiKey: input.apiKey,
    },
  })
}

// --- internal request (uses your copied HTTP layer) ---
async function scanText(
  texts: string[],
  ignoreHashes?: string[],
  overrideClient?: HttpClient
): Promise<ApiResponse<ScanResult, any>> {
  const activeClient = overrideClient ?? client
  if (!activeClient) {
    throw new Error(NOT_INITIALIZED_ERROR)
  }

  const res = await activeClient.sendApiRequest<ScanTextApiResponse>({
    method: 'POST',
    path: '/v1/scan/text',
    data: {
      texts,
      ignore_hashes: ignoreHashes,
    },
  })

  if (res.ok && res.data) {
    return { ok: true, error: null, data: mapResponse(res.data) }
  }

  return { ok: false, error: res.error, data: null }
}

const resolveInput = async (
  input: string | string[] | (() => string | string[] | Promise<string | string[]>)
) => {
  return typeof input === 'function' ? await input() : input
}

const toTexts = (input: string | string[]) => {
  return Array.isArray(input) ? input.map(String) : [String(input)]
}

const createLocalClient = <TContext = Record<string, unknown>>(
  options?: GuardOptions<TContext>
) => {
  if (!options?.apiKey) {
    return null
  }

  return new HttpClient({
    baseUrl: options.baseUrl,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
    authorization: {
      apiKey: options.apiKey,
    },
  })
}

// --- camelCase mapping ---
function mapResponse(res: any): ScanResult {
  const findings = Array.isArray(res.findings) ? res.findings : []

  return {
    hasSecret: findings.length > 0,
    findings: findings.map((f: any) => ({
      textIndex: f.text_index ?? f.textIndex,
      category: f.category,
      severity: f.severity,
      preview: f.preview,
      valueSha256: f.value_sha256 ?? f.valueSha256,
      range: {
        startLine: f.range?.start_line ?? f.range?.startLine ?? 1,
        endLine: f.range?.end_line ?? f.range?.endLine ?? 1,
      },
    })),
  }
}

/**
 * Runs secret scanning in fire-and-forget mode and returns the original input.
 *
 * This function never blocks on network scanning. Results are delivered through callbacks:
 * - `onResult` when a scan succeeds and detects secrets
 * - `onError` when scan execution fails
 *
 * @param input - A string, string array, or resolver returning either.
 * @param options - Guard behavior options, callbacks, and optional inline client config.
 * @returns The resolved original input.
 */
export async function guard<TContext = Record<string, unknown>>(
  input: string | string[] | (() => string | string[] | Promise<string | string[]>),
  options: GuardOptions<TContext> = {}
): Promise<string | string[]> {
  let result: string | string[]
  try {
    result = await resolveInput(input)
  } catch (err) {
    options.onError?.(err, options.context)
    throw err
  }

  const localClient = createLocalClient(options)
  if (config?.enabled === false && !localClient) {
    return result
  }

  const texts = toTexts(result).filter((t) => t.trim().length > 0)
  if (texts.length === 0) {
    return result
  }
  const rawRate = options.sampleRate ?? config?.sampleRate ?? 1
  const normalizedRate = typeof rawRate === 'number' && Number.isFinite(rawRate) ? rawRate : 1
  const rate = Math.max(0, Math.min(1, normalizedRate))
  if (rate < 1 && Math.random() > rate) {
    return result
  }

  // fire-and-forget
  let trackedScan: Promise<void>
  trackedScan = scanText(texts, options.ignoreHashes, localClient ?? undefined)
    .then((res) => {
      if (res.ok && res.data) {
        if (res.data.hasSecret) {
          if (options.onResult) {
            options.onResult(res.data, options.context)
          }
        }
        return
      }

      options.onError?.(res.error, options.context)
    })
    .catch((err) => {
      options.onError?.(err, options.context)
    })
    .finally(() => {
      pendingScans.delete(trackedScan)
    })
  pendingScans.add(trackedScan)

  return result
}

/**
 * Runs blocking secret scanning and returns API-style output.
 *
 * No callback hooks are used in this mode.
 *
 * @param input - A string, string array, or resolver returning either.
 * @param options - Scan options with optional inline client config.
 * @returns `{ ok, data, error }` where `data` is present only when `ok` is true.
 */
export async function scan(
  input: string | string[] | (() => string | string[] | Promise<string | string[]>),
  options: {
    ignoreHashes?: string[]
    apiKey?: string
    baseUrl?: string
    timeoutMs?: number
    retries?: number
  } = {}
): Promise<{
  ok: boolean
  data: ScanResult | null
  error: unknown
}> {
  try {
    const result = await resolveInput(input)
    const localClient = createLocalClient(options)

    if (config?.enabled === false && !localClient) {
      return { ok: true, data: null, error: null }
    }

    const texts = toTexts(result).filter((t) => t.trim().length > 0)
    if (texts.length === 0) {
      return { ok: true, data: null, error: null }
    }

    const res = await scanText(texts, options.ignoreHashes, localClient ?? undefined)
    return res
  } catch (error) {
    return { ok: false, data: null, error }
  }
}

/**
 * Waits for all currently in-flight `guard()` scan tasks to settle.
 *
 * Useful for graceful shutdowns where background scan requests should be drained.
 *
 * @example
 * ```ts
 * process.on('SIGTERM', async () => {
 *   await flush()
 *   process.exit(0)
 * })
 * ```
 */
export async function flush(): Promise<void> {
  await Promise.allSettled([...pendingScans])
}
