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

const callOpenAIWithGuard = async (prompt: string, openai: OpenAIClientLike) => {
  const scannedPrompt = await guard(prompt, { async: false })

  await openai.responses.create({
    model: 'gpt-4o-mini',
    input: scannedPrompt,
  } as never)
}

describe('guard + OpenAI prompt flow', () => {
  beforeEach(() => {
    sendApiRequestMock.mockReset()
  })

  it('scans prompt before OpenAI request', async () => {
    initGuard({ apiKey: 'guard-key' })
    sendApiRequestMock.mockResolvedValue({
      ok: true,
      data: { hasLeak: false, findings: [] },
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
})
