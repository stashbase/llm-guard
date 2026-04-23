import { ApiError, ApiErrorDetails } from '../http/response'
import {
  AccessApiError,
  ApiErrorType,
  AuthApiError,
  ConflictApiError,
  QuotaLimitApiError,
  ResourceApiError,
  TooManyRequestsApiError,
  SeverApiError,
  ValidationApiError,
} from '../types/errors'

type ApiErrorTypeMapping = {
  // eslint-disable-next-line camelcase
  rate_limit: TooManyRequestsApiError
  auth: AuthApiError<string, undefined | ApiErrorDetails>
  access: AccessApiError<string, undefined | ApiErrorDetails>
  resource: ResourceApiError<string, undefined | ApiErrorDetails>
  validation: ValidationApiError<string, undefined | ApiErrorDetails>
  conflict: ConflictApiError<string, undefined | ApiErrorDetails>
  quota: QuotaLimitApiError<string, undefined | ApiErrorDetails>
  server: SeverApiError<string, undefined | ApiErrorDetails>
}

export type ExtractApiError<T extends ApiErrorType> = T extends keyof ApiErrorTypeMapping
  ? ApiErrorTypeMapping[T]
  : never
