import { describe, expect, it } from 'vitest'

const apiKey = process.env.LLM_GUARD_API_KEY
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === '1'
const baseUrl = (process.env.LLM_GUARD_BASE_URL ?? 'https://api.stashbase.dev').replace(/\/+$/, '')
const describeIntegration = apiKey && runIntegrationTests ? describe : describe.skip

describeIntegration('scan text integration', () => {
  it('sends a real request with a hardcoded secret and validates response', async () => {
    if (!apiKey) {
      throw new Error('LLM_GUARD_API_KEY is required for integration tests.')
    }

    ;(globalThis as Record<string, unknown>).__SDK_VERSION__ = 'test'
    ;(globalThis as Record<string, unknown>).__SDK_DEV_API_URL__ = ''
    const { createHttpClient } = await import('../src/http/client')

    const hardcodedSecretPrompt = [
      'Some random text',
      // This is not valid working but serves the purpose of testing the integration with
      'OPENAI_API_KEY=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',
    ].join('\n')

    const client = createHttpClient({
      baseUrl,
      authorization: { apiKey },
    })

    const res = await client.sendApiRequest({
      method: 'POST',
      path: '/v1/scan/text',
      data: {
        texts: [hardcodedSecretPrompt],
      },
    })

    if (!res.ok) {
      throw new Error(`scan request failed: ${JSON.stringify(res.error)}`)
    }

    expect(res.ok).toBe(true)
    expect(res.error).toBeNull()
    expect(res.data).not.toBeNull()

    const data = res.data as {
      findings: Array<{
        category: string
        preview: string
      }>
    }

    expect(Array.isArray(data.findings)).toBe(true)
    expect(data.findings.length).toBeGreaterThan(0)
    expect(typeof data.findings[0]?.category).toBe('string')
    expect(typeof data.findings[0]?.preview).toBe('string')
  }, 20_000)
})
