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
      data: { has_secret: false, findings: [] },
      error: null,
    })
    const { guard } = await loadGuardModule(sendApiRequestMock)

    await guard('hello', {
      apiKey: 'inline-api-key',
      baseUrl: 'https://api.example.test',
      timeoutMs: 2500,
      retries: 2,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sendApiRequestMock).toHaveBeenCalledTimes(1)
    expect(sendApiRequestMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/scan/text',
      data: {
        texts: ['hello'],
        ignore_hashes: undefined,
      },
    })
  })

  it('scan supports inline client config without initGuard', async () => {
    const sendApiRequestMock = vi.fn().mockResolvedValue({
      ok: true,
      data: { has_secret: false, findings: [] },
      error: null,
    })
    const { scan } = await loadGuardModule(sendApiRequestMock)

    const res = await scan('hello', {
      apiKey: 'inline-api-key',
      baseUrl: 'https://api.example.test',
      timeoutMs: 1500,
      retries: 1,
    })

    expect(res.ok).toBe(true)
    expect(sendApiRequestMock).toHaveBeenCalledTimes(1)
    expect(sendApiRequestMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/scan/text',
      data: {
        texts: ['hello'],
        ignore_hashes: undefined,
      },
    })
  })

  it('does not throw when neither initGuard nor inline apiKey is provided', async () => {
    const sendApiRequestMock = vi.fn()
    const { guard } = await loadGuardModule(sendApiRequestMock)

    await expect(guard('hello')).resolves.toBe('hello')
    expect(sendApiRequestMock).not.toHaveBeenCalled()
  })

  it('rethrows input resolver errors in guard and calls onError', async () => {
    const sendApiRequestMock = vi.fn()
    const { guard } = await loadGuardModule(sendApiRequestMock)
    const inputError = new Error('input failed')
    const onError = vi.fn()

    await expect(
      guard(() => {
        throw inputError
      }, { onError })
    ).rejects.toThrow('input failed')
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(inputError)
    expect(sendApiRequestMock).not.toHaveBeenCalled()
  })

  it('skips scan when resolved texts are empty or whitespace only', async () => {
    const sendApiRequestMock = vi.fn()
    const { guard, scan } = await loadGuardModule(sendApiRequestMock)

    await expect(guard(['', '   '])).resolves.toEqual(['', '   '])
    const scanRes = await scan(['', '   '])

    expect(scanRes).toEqual({ ok: true, data: null, error: null })
    expect(sendApiRequestMock).not.toHaveBeenCalled()
  })
})
