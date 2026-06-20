import { beforeEach, describe, expect, it, vi } from 'vitest'
import type OpenAI from 'openai'

const sendApiRequestMock = vi.fn()

vi.mock('../src/http/client', () => {
  return {
    HttpClient: class {
      sendApiRequest = sendApiRequestMock
    },
  }
})

import { flush, guard, initGuard, scan } from '../src/index'

type OpenAIClientLike = Pick<OpenAI, 'responses'>
type OpenAIChatClientLike = Pick<OpenAI, 'chat'>

const callOpenAIWithGuard = async (prompt: string, openai: OpenAIClientLike) => {
  await scan(prompt)

  await openai.responses.create({
    model: 'gpt-4o-mini',
    input: prompt,
  } as never)
}

const callChatRouteWithGuard = async (message: string, openai: OpenAIChatClientLike) => {
  const userInput = message

  await guard(() => userInput, {
    onResult: (r) => {
      if (r.hasSecret) {
        console.warn('User sent possible secret')
      }
    },
  })

  const aiRes = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: userInput }],
  } as never)

  const output = aiRes.choices[0]?.message?.content ?? ''
  await guard(() => output, { onResult: () => {} })

  return { message: output }
}

describe('guard + OpenAI prompt flow', () => {
  beforeEach(() => {
    sendApiRequestMock.mockReset()
  })

  it('scans prompt before OpenAI request', async () => {
    initGuard({ apiKey: 'guard-key' })
    sendApiRequestMock.mockResolvedValue({
      ok: true,
      data: { has_secret: false, findings: [] },
      error: null,
    })

    const openai = {
      responses: {
        create: vi.fn().mockResolvedValue({ id: 'resp_1' }),
      },
    } as unknown as OpenAIClientLike

    const prompt = 'Write a release note for this diff.'
    await callOpenAIWithGuard(prompt, openai)

    expect(sendApiRequestMock).toHaveBeenCalledTimes(1)
    expect(sendApiRequestMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/scan/text',
      data: {
        texts: [prompt],
        ignore_hashes: undefined,
      },
    })
    expect(openai.responses.create).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      input: prompt,
    })
  })

  it('does not scan when guard is disabled', async () => {
    initGuard({ apiKey: 'guard-key', enabled: false })

    const openai = {
      responses: {
        create: vi.fn().mockResolvedValue({ id: 'resp_2' }),
      },
    } as unknown as OpenAIClientLike

    const prompt = 'Summarize this architecture decision.'
    await callOpenAIWithGuard(prompt, openai)

    expect(sendApiRequestMock).not.toHaveBeenCalled()
    expect(openai.responses.create).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      input: prompt,
    })
  })

  it('swallows scan errors and still calls OpenAI', async () => {
    initGuard({ apiKey: 'guard-key' })
    sendApiRequestMock.mockRejectedValue(new Error('scan backend unavailable'))

    const openai = {
      responses: {
        create: vi.fn().mockResolvedValue({ id: 'resp_3' }),
      },
    } as unknown as OpenAIClientLike

    const prompt = 'Generate three test scenarios for JWT refresh.'
    await expect(callOpenAIWithGuard(prompt, openai)).resolves.toBeUndefined()

    expect(sendApiRequestMock).toHaveBeenCalledTimes(1)
    expect(openai.responses.create).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      input: prompt,
    })
  })

  it('calls onResult when leak is detected in async mode', async () => {
    initGuard({ apiKey: 'guard-key' })
    sendApiRequestMock.mockResolvedValue({
      ok: true,
      data: {
        has_secret: true,
        findings: [
          {
            text_index: 0,
            category: 'api_key',
            severity: 'high',
            preview: 'sk-***',
            value_sha256: 'abc123',
            occurrences: [{ start_line: 1, end_line: 1 }],
          },
        ],
      },
      error: null,
    })

    const onResult = vi.fn()
    await guard('secret sk-test', { onResult })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult.mock.calls[0][0].hasSecret).toBe(true)
  })

  it('calls onError when async scan returns API failure response', async () => {
    initGuard({ apiKey: 'guard-key' })
    const apiError = { code: 'server.unavailable', message: 'temporary outage' }
    sendApiRequestMock.mockResolvedValue({
      ok: false,
      data: null,
      error: apiError,
    })

    const onError = vi.fn()
    await guard('secret sk-test', { onResult: () => {}, onError })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(apiError, undefined)
  })

  it('calls onError when async scan throws', async () => {
    initGuard({ apiKey: 'guard-key' })
    const thrownError = new Error('network down')
    sendApiRequestMock.mockRejectedValue(thrownError)

    const onError = vi.fn()
    await guard('secret sk-test', { onResult: () => {}, onError })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(thrownError, undefined)
  })

  it('flush waits for in-flight guard scans to settle', async () => {
    initGuard({ apiKey: 'guard-key' })
    let resolveRequest!: () => void
    sendApiRequestMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = () => {
            resolve({
              ok: true,
              data: { has_secret: false, findings: [] },
              error: null,
            })
          }
        })
    )

    await guard('pending scan', { onResult: () => {} })
    const onFlushed = vi.fn()
    const flushPromise = flush().then(onFlushed)

    await Promise.resolve()
    expect(onFlushed).not.toHaveBeenCalled()
    resolveRequest()
    await flushPromise
    expect(onFlushed).toHaveBeenCalledTimes(1)
  })

  it('blocks execution until scan completes in sync mode', async () => {
    initGuard({ apiKey: 'guard-key' })
    const order: string[] = []

    sendApiRequestMock.mockImplementation(async () => {
      order.push('scan')
      return {
        ok: true,
        data: { has_secret: false, findings: [] },
        error: null,
      }
    })

    await scan(() => {
      order.push('input')
      return 'hello'
    })

    order.push('after')

    expect(order).toEqual(['input', 'scan', 'after'])
  })

  it('passes array inputs to scan endpoint', async () => {
    initGuard({ apiKey: 'guard-key' })
    sendApiRequestMock.mockResolvedValue({
      ok: true,
      data: { has_secret: false, findings: [] },
      error: null,
    })

    await guard(['text1', 'text2'], { onResult: () => {} })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sendApiRequestMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/scan/text',
      data: {
        texts: ['text1', 'text2'],
        ignore_hashes: undefined,
      },
    })
  })

  it('detects secrets in llm output text', async () => {
    initGuard({ apiKey: 'guard-key' })
    sendApiRequestMock.mockResolvedValue({
      ok: true,
      data: {
        has_secret: true,
        findings: [
          {
            text_index: 0,
            category: 'api_key',
            severity: 'high',
            preview: 'sk-***',
            value_sha256: 'abc123',
            occurrences: [{ start_line: 1, end_line: 1 }],
          },
        ],
      },
      error: null,
    })

    const onResult = vi.fn()
    const llmOutput = 'The key is sk-test-123'
    await guard(() => llmOutput, { onResult })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sendApiRequestMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/scan/text',
      data: {
        texts: [llmOutput],
        ignore_hashes: undefined,
      },
    })
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult.mock.calls[0][0].hasSecret).toBe(true)
  })

  it('propagates custom context to callbacks', async () => {
    initGuard({ apiKey: 'guard-key' })
    sendApiRequestMock.mockResolvedValue({
      ok: true,
      data: {
        has_secret: true,
        findings: [
          {
            text_index: 0,
            category: 'api_key',
            severity: 'high',
            preview: 'sk-***',
            value_sha256: 'abc123',
            occurrences: [{ start_line: 1, end_line: 1 }],
          },
        ],
      },
      error: null,
    })

    const context = { chatId: 'chat-1', userId: 'user-1' }
    const onResult = vi.fn()
    await guard('secret sk-test', { context, onResult })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult.mock.calls[0][0].hasSecret).toBe(true)
    expect(onResult.mock.calls[0][1]).toEqual(context)
  })

  it('skips scanning when sampleRate is 0', async () => {
    initGuard({ apiKey: 'guard-key' })
    sendApiRequestMock.mockResolvedValue({
      ok: true,
      data: { has_secret: false, findings: [] },
      error: null,
    })

    await guard('text1', { onResult: () => {}, sampleRate: 0 })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sendApiRequestMock).not.toHaveBeenCalled()
  })

  it('uses global sampleRate from initGuard when per-call sampleRate is not provided', async () => {
    initGuard({ apiKey: 'guard-key', sampleRate: 0 })
    sendApiRequestMock.mockResolvedValue({
      ok: true,
      data: { has_secret: false, findings: [] },
      error: null,
    })

    await guard('text1', { onResult: () => {} })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sendApiRequestMock).not.toHaveBeenCalled()
  })

  it('falls back to default sampling when sampleRate is invalid at runtime', async () => {
    initGuard({ apiKey: 'guard-key' })
    sendApiRequestMock.mockResolvedValue({
      ok: true,
      data: { has_secret: false, findings: [] },
      error: null,
    })

    await guard('text1', { onResult: () => {}, sampleRate: Number.NaN as unknown as number })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sendApiRequestMock).toHaveBeenCalledTimes(1)
  })

  it('guards user input and model output in chat flow', async () => {
    initGuard({ apiKey: 'guard-key' })
    sendApiRequestMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          has_secret: true,
          findings: [
            {
              text_index: 0,
              category: 'api_key',
              severity: 'high',
              preview: 'sk-***',
              value_sha256: 'abc123',
              occurrences: [{ start_line: 1, end_line: 1 }],
            },
          ],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { has_secret: false, findings: [] },
        error: null,
      })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const openai = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Safe model output' } }],
          }),
        },
      },
    } as unknown as OpenAIChatClientLike

    await expect(callChatRouteWithGuard('my secret is sk-test-123', openai)).resolves.toEqual({
      message: 'Safe model output',
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sendApiRequestMock).toHaveBeenCalledTimes(2)
    expect(sendApiRequestMock).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      path: '/v1/scan/text',
      data: {
        texts: ['my secret is sk-test-123'],
        ignore_hashes: undefined,
      },
    })
    expect(sendApiRequestMock).toHaveBeenNthCalledWith(2, {
      method: 'POST',
      path: '/v1/scan/text',
      data: {
        texts: ['Safe model output'],
        ignore_hashes: undefined,
      },
    })
    expect(warnSpy).toHaveBeenCalledWith('User sent possible secret')

    warnSpy.mockRestore()
  })
})
