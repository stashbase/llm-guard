import { ApiError, ApiErrorDetails } from '../http/response'
import { ConnectionFailedError, ServerTemporaryUnavailableError } from '../types/errors'

export function createApiErrorFromResponse<T>(responseData: unknown) {
  if (responseData instanceof Error && responseData.name === 'ServerTemporaryUnavailableError') {
    return serverTemporaryUnavailableError
  }

  const getRequestIdFromDetails = (details: unknown): string | undefined => {
    if (!details || typeof details !== 'object') {
      return undefined
    }

    const maybeDetails = details as { requestId?: unknown; request?: { id?: unknown } }

    if (typeof maybeDetails.requestId === 'string') {
      return maybeDetails.requestId
    }

    if (maybeDetails.request && typeof maybeDetails.request.id === 'string') {
      return maybeDetails.request.id
    }

    return undefined
  }

  if (typeof responseData === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resData = responseData as {
      error?: ApiError<string, any> & { requestId?: string }
      requestId?: string
    }

    if (resData && resData.error) {
      const requestId =
        resData.error.requestId ??
        getRequestIdFromDetails(resData.error.details) ??
        resData.requestId

      const error = new ApiError(
        resData.error.code,
        resData.error.details,
        resData.error.message,
        requestId
      ) as T

      return error
    }
  }

  return connectionFailedError
}

export const createApiError = <T extends string, D = undefined | ApiErrorDetails>(args: {
  code: T
  message: string
  details: D
  requestId?: string
}) => {
  const error = new ApiError(args.code, args.details, args.message, args.requestId)
  return error
}

const connectionFailedError: ConnectionFailedError = createApiError({
  code: 'server.connection_failed',
  message: 'Could not connect to the API server. Please try again later.',
  details: undefined,
})

export const serverTemporaryUnavailableError: ServerTemporaryUnavailableError = createApiError({
  code: 'server.temporary_unavailable',
  message: 'API service is temporarily unavailable. Please try again later.',
  details: undefined,
})
