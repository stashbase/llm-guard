import { ApiError } from '../http/response'
import { SdkErrorCode, GlobalErrorCode } from '../types/errors'

export const createApiError = <TCode extends string>(args: {
  code: TCode
  message: string
  details?: unknown
}): ApiError<TCode> => {
  return {
    code: args.code,
    message: args.message,
    details: args.details,
  }
}

export const connectionFailedError: ApiError<SdkErrorCode> = createApiError({
  code: 'server.connection_failed',
  message: 'Could not connect to the API server. Please try again later.',
})

export const serverTemporaryUnavailableError: ApiError<GlobalErrorCode> = createApiError({
  code: 'server.temporary_unavailable',
  message: 'API service is temporarily unavailable. Please try again later.',
})
