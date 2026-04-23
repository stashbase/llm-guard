const DEFAULT_BASE_BACKOFF_MS = 300
const DEFAULT_MAX_BACKOFF_MS = 3000
const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 504])

type RetryOptions = {
  retries?: number
  timeoutMs?: number
  signal?: AbortSignal
  baseBackoffMs?: number
  maxBackoffMs?: number
}

const createAbortError = (): Error => {
  const error = new Error('The request was aborted.')
  error.name = 'AbortError'
  return error
}

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError'

const sleep = (ms: number, signal?: AbortSignal): Promise<void> => {
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError())
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    const onAbort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      reject(createAbortError())
    }

    signal.addEventListener('abort', onAbort)
  })
}

const createAttemptSignal = (signal?: AbortSignal, timeoutMs?: number) => {
  const controller = new AbortController()

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined

  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      onAbort = () => controller.abort()
      signal.addEventListener('abort', onAbort)
    }
  }

  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort()
    }, timeoutMs)
  }

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    if (signal && onAbort) {
      signal.removeEventListener('abort', onAbort)
    }
  }

  return { signal: controller.signal, cleanup }
}

const shouldRetryStatusCode = (statusCode: number) => RETRYABLE_STATUS_CODES.has(statusCode)

const getBackoffDelayMs = (args: {
  attempt: number
  baseBackoffMs: number
  maxBackoffMs: number
}) => {
  const { attempt, baseBackoffMs, maxBackoffMs } = args
  const exponentialDelay = Math.min(maxBackoffMs, baseBackoffMs * 2 ** Math.max(0, attempt - 1))
  const jitter = Math.floor(Math.random() * Math.max(1, exponentialDelay))

  return exponentialDelay + jitter
}

const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> => {
  const retries = retryOptions?.retries ?? 3
  const baseBackoffMs = retryOptions?.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS
  const maxBackoffMs = retryOptions?.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS

  const fetchRetry = async (attemptsRemaining: number, attempt: number): Promise<Response> => {
    const { signal, cleanup } = createAttemptSignal(retryOptions?.signal, retryOptions?.timeoutMs)

    try {
      const response = await fetch(url, {
        ...options,
        signal,
      })

      cleanup()

      if (shouldRetryStatusCode(response.status)) {
        if (attemptsRemaining === 1) {
          return response
        }

        const delayMs = getBackoffDelayMs({
          attempt,
          baseBackoffMs,
          maxBackoffMs,
        })

        await sleep(delayMs, retryOptions?.signal)
        return fetchRetry(attemptsRemaining - 1, attempt + 1)
      }

      return response
    } catch (error) {
      cleanup()

      if (isAbortError(error)) {
        throw error
      }

      if (attemptsRemaining === 1) {
        throw error
      }

      const delayMs = getBackoffDelayMs({
        attempt,
        baseBackoffMs,
        maxBackoffMs,
      })

      await sleep(delayMs, retryOptions?.signal)
      return fetchRetry(attemptsRemaining - 1, attempt + 1)
    }
  }

  if (retryOptions?.signal?.aborted) {
    throw createAbortError()
  }

  return fetchRetry(retries, 1)
}

export default fetchWithRetry
