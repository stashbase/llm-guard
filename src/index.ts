import { HttpClient } from './http/client'
import { ApiResponse } from './http/response'

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
  value?: string
}

export type ScanResult = {
  hasLeak: boolean
  findings: ScanFinding[]
}

type ScanTextApiResponse = {
  has_leak: boolean
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
    value?: string
  }>
}

export type GuardOptions = {
  async?: boolean // default true
  ignoreHashes?: string[]
  onResult?: (res: ScanResult) => void
  apiKey?: string
  baseUrl?: string
  timeoutMs?: number
  retries?: number
}

// --- internal config ---
type GuardConfig = {
  apiKey: string
  enabled?: boolean
  baseUrl?: string
  timeoutMs?: number
  retries?: number
}

let config: GuardConfig | null = null
let client: HttpClient | null = null

// --- init ---
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
    throw new Error('llm-guard not initialized. Call initGuard({ apiKey }) first.')
  }

  const res = await activeClient.sendApiRequest<ScanTextApiResponse>({
    method: 'POST',
    path: '/scan/text',
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

// --- camelCase mapping ---
function mapResponse(res: any): ScanResult {
  return {
    hasLeak: res.has_leak,
    findings: res.findings.map((f: any) => ({
      textIndex: f.text_index,
      category: f.category,
      severity: f.severity,
      preview: f.preview,
      valueSha256: f.value_sha256,
      range: {
        startLine: f.range?.start_line ?? 1,
        endLine: f.range?.end_line ?? 1,
      },
      value: f.value,
    })),
  }
}

// --- core guard ---
export async function guard(
  input: string | string[] | (() => string | string[] | Promise<string | string[]>),
  options: GuardOptions = {}
) {
  const result = typeof input === 'function' ? await input() : input

  if (config?.enabled === false) {
    return result
  }

  const texts = Array.isArray(result) ? result.map(String) : [String(result)]
  const isAsync = options.async !== false
  const localClient = options.apiKey
    ? new HttpClient({
        baseUrl: options.baseUrl,
        timeoutMs: options.timeoutMs,
        retries: options.retries,
        authorization: {
          apiKey: options.apiKey,
        },
      })
    : null

  if (!localClient && !client) {
    throw new Error('llm-guard not initialized. Call initGuard({ apiKey }) first.')
  }

  if (isAsync) {
    // fire-and-forget
    scanText(texts, options.ignoreHashes, localClient ?? undefined)
      .then((res) => {
        if (res.ok && res.data && res.data.hasLeak) {
          if (options.onResult) {
            options.onResult(res.data)
          } else {
            console.warn(
              '⚠️ Potential secret leak detected:',
              res.data.findings.map((f) => `${f.category}: ${f.preview}`).join(', ')
            )
          }
        }
      })
      .catch(() => {})

    return result
  }

  // blocking mode
  try {
    const res = await scanText(texts, options.ignoreHashes, localClient ?? undefined)

    if (res.data && res.data.hasLeak) {
      console.warn(
        '⚠️ Potential secret leak detected:',
        res.data.findings.map((f) => `${f.category}: ${f.preview}`).join(', ')
      )
    }
  } catch {
    // swallow error
  }

  return result
}

// --- helper ---
export async function sanitize(input: string | string[], options?: GuardOptions) {
  return guard(input, options)
}
