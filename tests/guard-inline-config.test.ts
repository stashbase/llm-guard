import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadGuardModule = async (sendApiRequestMock: ReturnType<typeof vi.fn>) => {
  vi.doMock('../src/http/client', () => {
    return {
      HttpClient: class {
        sendApiRequest = sendApiRequestMock
      },
    }
  })

  return import('../src/index')
}

describe('guard inline config', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('works without initGuard when apiKey is provided in options', async () => {
    const sendApiRequestMock = vi.fn().mockResolvedValue({
      ok: true,
      data: { has_leak: false, findings: [] },
      error: null,
    })
    const { guard } = await loadGuardModule(sendApiRequestMock)

    await guard('hello', {
      async: false,
      apiKey: 'inline-api-key',
      baseUrl: 'https://api.example.test',
      timeoutMs: 2500,
      retries: 2,
    })

    expect(sendApiRequestMock).toHaveBeenCalledTimes(1)
    expect(sendApiRequestMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/scan/text',
      data: {
        texts: ['hello'],
        ignore_hashes: undefined,
      },
    })
  })

  it('throws when neither initGuard nor inline apiKey is provided', async () => {
    const sendApiRequestMock = vi.fn()
    const { guard } = await loadGuardModule(sendApiRequestMock)

    await expect(guard('hello')).rejects.toThrow(
      'llm-guard not initialized. Call initGuard({ apiKey }) first.'
    )
    expect(sendApiRequestMock).not.toHaveBeenCalled()
  })
})
