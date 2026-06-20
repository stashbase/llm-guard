import { describe, it, expect, vi, beforeEach } from 'vitest'
import type OpenAI from 'openai'
import { guard, initGuard, scan } from '../src/index'

describe('guard with OpenAI types', () => {
  beforeEach(() => {
    initGuard({
      apiKey: process.env.LLM_GUARD_API_KEY ?? '',
      baseUrl: process.env.LLM_GUARD_BASE_URL ?? process.env.DEV_API_URL, // or mocked backend
      timeoutMs: 3000,
      retries: 1,
    })
  })

  it('guards OpenAI chat response content', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // simulate OpenAI response (typed, but not real call)
    const openaiResponse = {
      choices: [
        {
          message: {
            content:
              'Here is the API key I used: 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',
          },
        },
      ],
    } as unknown as OpenAI.Chat.Completions.ChatCompletion

    const content = openaiResponse.choices[0]?.message?.content ?? ''

    const callbackResult = await Promise.race<
      { type: 'result'; payload: unknown } | { type: 'error'; payload: unknown } | null
    >([
      new Promise((resolve) => {
        void guard(() => content, {
          onResult(res) {
            console.log('Guard result:', res)
            resolve({ type: 'result', payload: res })
          },
          onError(err) {
            console.log('Guard error:', err)
            resolve({ type: 'error', payload: err })
          },
        })
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ])

    if (callbackResult?.type === 'result') {
      const res = callbackResult.payload as { hasSecret: boolean }
      expect(res.hasSecret).toBe(true)
    } else if (callbackResult?.type === 'error') {
      console.log('Guard error:', callbackResult.payload)
    } else {
      const res = await scan(() => content)
      expect(res.ok).toBe(true)
      if (res.data) {
        expect(res.data.hasSecret).toBe(false)
      }
    }

    warnSpy.mockRestore()
  }, 20000)

  it('guards OpenAI chat response with multiple text items', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // simulate OpenAI response (typed, but not real call)
    const openaiResponse = {
      choices: [
        {
          message: {
            content:
              'Here is the API key I used: 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',
          },
        },
        {
          message: {
            content:
              'Some preamble text here.\nMore context and details.\nAdditional information before the secret.\nAnother API Key we use: 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',
          },
        },
      ],
    } as unknown as OpenAI.Chat.Completions.ChatCompletion

    const content = openaiResponse.choices
      .map((choice) => choice.message?.content)
      .filter(Boolean) as string[]
    console.log('Extracted content:', content)

    const callbackResult = await Promise.race<
      { type: 'result'; payload: unknown } | { type: 'error'; payload: unknown } | null
    >([
      new Promise((resolve) => {
        void guard(() => content, {
          onResult(res) {
            console.log('Guard result:', res)

            for (const r of res.findings) {
              console.log(
                `Finding: ${r.preview} (severity: ${r.severity}, category: ${r.category}), occurrences: ${r.occurrences
                  .map((occurrence) => `${occurrence.startLine}-${occurrence.endLine}`)
                  .join(', ')} in text index ${r.textIndex}`
              )
            }
            resolve({ type: 'result', payload: res })
          },
          onError(err) {
            console.log('Guard error:', err)
            resolve({ type: 'error', payload: err })
          },
        })
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ])

    if (callbackResult?.type === 'result') {
      const res = callbackResult.payload as { hasSecret: boolean }
      expect(res.hasSecret).toBe(true)
    } else if (callbackResult?.type === 'error') {
      console.log('Guard error:', callbackResult.payload)
    } else {
      const res = await scan(() => content)
      expect(res.ok).toBe(true)
      if (res.data) {
        expect(res.data.hasSecret).toBe(false)
      }
    }

    warnSpy.mockRestore()
  }, 20000)
})
