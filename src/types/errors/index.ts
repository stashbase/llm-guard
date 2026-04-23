import { ApiError, ApiErrorDetails } from '../../http/response'

export type AuthErrorCodePrefix = 'auth'
export type AccessErrorCodePrefix = 'access'
export type ResourceErrorCodePrefix = 'resource'
export type ValidationErrorCodePrefix = 'validation'
export type ConflictErrorCodePrefix = 'conflict'
export type QuotaLimitErrorCodePrefix = 'quota'
export type RateLimitErrorCodePrefix = 'rate_limit'
export type ServerErrorCodePrefix = 'server'

type ApiErrorDetailsGenericType = undefined | ApiErrorDetails

export type ApiErrorType =
  | AuthErrorCodePrefix
  | AccessErrorCodePrefix
  | ResourceErrorCodePrefix
  | ValidationErrorCodePrefix
  | ConflictErrorCodePrefix
  | QuotaLimitErrorCodePrefix
  | RateLimitErrorCodePrefix
  | ServerErrorCodePrefix

export type SeverApiError<T extends string, D = ApiErrorDetailsGenericType> = ApiError<
  `${ServerErrorCodePrefix}.${T}`,
  D
>

export type AuthApiError<T extends string, D = ApiErrorDetailsGenericType> = ApiError<
  `${AuthErrorCodePrefix}.${T}`,
  D
>

export type AccessApiError<T extends string, D = ApiErrorDetailsGenericType> = ApiError<
  `${AccessErrorCodePrefix}.${T}`,
  D
>

export type ResourceApiError<T extends string, D = ApiErrorDetailsGenericType> = ApiError<
  `${ResourceErrorCodePrefix}.${T}`,
  D
>

export type ValidationApiError<T extends string, D = ApiErrorDetailsGenericType> = ApiError<
  `${ValidationErrorCodePrefix}.${T}`,
  D
>

export type ConflictApiError<T extends string, D = ApiErrorDetailsGenericType> = ApiError<
  `${ConflictErrorCodePrefix}.${T}`,
  D
>

export type QuotaLimitApiError<T extends string, D = ApiErrorDetailsGenericType> = ApiError<
  `${QuotaLimitErrorCodePrefix}.${T}`,
  D
>
export type RateLimitApiError<T extends string, D = ApiErrorDetailsGenericType> = ApiError<
  `${RateLimitErrorCodePrefix}.${T}`,
  D
>

export type GenericApiError =
  | UnauthorizedApiError
  | TooManyRequestsApiError
  | UnsupportedApiKeyTypeError
  | ExpiredApiKeyError
  | MissingPermissionError
  | BadRequestError
  | InternalServerError
  | ConnectionFailedError
  | ServerTemporaryUnavailableError

type MissingPermissionError = AccessApiError<
  'missing_permission',
  {
    requiredPermissions?: string[]
    userWorkspaceRole?: {
      current: string
      allowed: string[]
    }
    projectRole?: {
      current: string
      allowed: string[]
    }
  }
>

type UnsupportedApiKeyTypeError = AccessApiError<
  'unsupported_api_key_type',
  { supportedApiKeyTypes: string[] }
>
type ExpiredApiKeyError = AuthApiError<'expired_api_key', { expiredAt: string }>

export type TooManyRequestsApiError = RateLimitApiError<
  'too_many_requests',
  { retryAfter: { seconds: number; unixTimestamp: number } }
>
type UnauthorizedApiError = AuthApiError<'unauthorized', undefined>

type BadRequestError = ValidationApiError<'bad_request', Record<string, unknown>>

type InternalServerError = SeverApiError<'internal_error', { requestId: string }>
export type ServerTemporaryUnavailableError = SeverApiError<'temporary_unavailable', undefined>

export type ConnectionFailedError = SeverApiError<'connection_failed', undefined>
