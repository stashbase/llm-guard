import { describe, it, expect, vi, beforeEach } from 'vitest'
import type OpenAI from 'openai'
import { guard, initGuard } from '../src/index'

// helper to flush async guard
const flush = () => new Promise(process.nextTick)

describe('guard with OpenAI types', () => {
  beforeEach(() => {
    initGuard({
      apiKey: process.env.LLM_GUARD_API_KEY ?? '',
      baseUrl: 'http://localhost:3000', // or mocked backend
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

    await guard(() => content, {
      onResult(res) {
        expect(res.hasLeak).toBe(true)
      },
      onError(err) {
        console.log('Guard error:', err)
      },
    })
    await flush()

    warnSpy.mockRestore()
  })
})
