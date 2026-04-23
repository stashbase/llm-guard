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

export type GuardOptions = {
  async?: boolean // default true
  ignoreHashes?: string[]
  onResult?: (res: ScanResult) => void
}

// --- internal config ---
type GuardConfig = {
  apiKey: string
  baseUrl?: string
  timeoutMs?: number
  retries?: number
}

let config: GuardConfig | null = null

// --- init ---
export function initGuard(input: GuardConfig) {
  config = input
}

// --- internal request (uses your copied HTTP layer) ---
async function scanText(
  texts: string[],
  ignoreHashes?: string[]
): Promise<ApiResponse<ScanResult, any>> {
  if (!config) {
    throw new Error('llm-guard not initialized. Call initGuard({ apiKey }) first.')
  }

  const client = new HttpClient({
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    retries: config.retries,
    authorization: {
      apiKey: config.apiKey,
    },
  })

  const res = await client.sendApiRequest<ScanResult>({
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
  const texts = Array.isArray(result) ? result.map(String) : [String(result)]
  const isAsync = options.async !== false

  if (isAsync) {
    // fire-and-forget
    scanText(texts, options.ignoreHashes)
      .then((res) => {
        if (res.ok && res.data && res.data.hasLeak) {
          if (options.onResult) {
            options.onResult(res.data)
          } else {
            console.warn(
              '⚠️ Potential secrets leak:',
              res.data.findings.map((f) => `${f.category} (${f.preview})`).join(', ')
            )
          }
        }
      })
      .catch(() => {})

    return result
  }

  // blocking mode
  const res = await scanText(texts, options.ignoreHashes)

  if (res.data && res.data.hasLeak) {
    console.warn(
      '⚠️ Potential secrets leak:',
      res.data.findings.map((f) => `${f.category} (${f.preview})`).join(', ')
    )
  }

  return result
}

// --- helper ---
export async function sanitize(input: string | string[], options?: GuardOptions) {
  return guard(input, options)
}
