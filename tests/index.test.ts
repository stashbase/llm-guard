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

import { guard, initGuard } from '../src/index'

type OpenAIClientLike = Pick<OpenAI, 'responses'>
type OpenAIChatClientLike = Pick<OpenAI, 'chat'>

const callOpenAIWithGuard = async (prompt: string, openai: OpenAIClientLike) => {
  const scannedPrompt = await guard(prompt, { async: false })

  await openai.responses.create({
    model: 'gpt-4o-mini',
    input: scannedPrompt,
  } as never)
}

const callChatRouteWithGuard = async (message: string, openai: OpenAIChatClientLike) => {
  const userInput = message

  await guard(() => userInput, {
    onResult: (r) => {
      if (r.hasLeak) {
        console.warn('User sent possible secret')
      }
    },
  })

  const aiRes = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: userInput }],
  } as never)

  const output = aiRes.choices[0]?.message?.content ?? ''
  await guard(() => output)

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
      data: { has_leak: false, findings: [] },
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
      path: '/scan/text',
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
        has_leak: true,
        findings: [
          {
            text_index: 0,
            category: 'api_key',
            severity: 'high',
            preview: 'sk-***',
            value_sha256: 'abc123',
            range: { start_line: 1, end_line: 1 },
          },
        ],
      },
      error: null,
    })

    const onResult = vi.fn()
    await guard('secret sk-test', { onResult })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult.mock.calls[0][0].hasLeak).toBe(true)
  })

  it('blocks execution until scan completes in sync mode', async () => {
    initGuard({ apiKey: 'guard-key' })
    const order: string[] = []

    sendApiRequestMock.mockImplementation(async () => {
      order.push('scan')
      return {
        ok: true,
        data: { has_leak: false, findings: [] },
        error: null,
      }
    })

    await guard(
      () => {
        order.push('input')
        return 'hello'
      },
      { async: false }
    )

    order.push('after')

    expect(order).toEqual(['input', 'scan', 'after'])
  })

  it('passes array inputs to scan endpoint', async () => {
    initGuard({ apiKey: 'guard-key' })
    sendApiRequestMock.mockResolvedValue({
      ok: true,
      data: { has_leak: false, findings: [] },
      error: null,
    })

    await guard(['text1', 'text2'])
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sendApiRequestMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/scan/text',
      data: {
        texts: ['text1', 'text2'],
        ignore_hashes: undefined,
      },
    })
  })

  it('guards user input and model output in chat flow', async () => {
    initGuard({ apiKey: 'guard-key' })
    sendApiRequestMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          has_leak: true,
          findings: [
            {
              text_index: 0,
              category: 'api_key',
              severity: 'high',
              preview: 'sk-***',
              value_sha256: 'abc123',
              range: { start_line: 1, end_line: 1 },
            },
          ],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { has_leak: false, findings: [] },
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
      path: '/scan/text',
      data: {
        texts: ['my secret is sk-test-123'],
        ignore_hashes: undefined,
      },
    })
    expect(sendApiRequestMock).toHaveBeenNthCalledWith(2, {
      method: 'POST',
      path: '/scan/text',
      data: {
        texts: ['Safe model output'],
        ignore_hashes: undefined,
      },
    })
    expect(warnSpy).toHaveBeenCalledWith('User sent possible secret')

    warnSpy.mockRestore()
  })
})
