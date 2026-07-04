export type GlobalErrorCode =
  | 'auth.unauthorized'
  | 'auth.expired_api_key'
  | 'rate_limit.too_many_requests'
  | 'server.internal_error'
  | 'server.temporary_unavailable'

export type SdkErrorCode = 'server.connection_failed'

export type GenericApiErrorCode = GlobalErrorCode | SdkErrorCode
