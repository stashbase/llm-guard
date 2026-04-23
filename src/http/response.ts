import { ExtractApiError } from '../errors/mappings'
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

export type ApiErrorDetails = Record<string, { [key: string]: object }>

/**
 * Represents an API error with a code, details, and message.
 * @template T - The type of the error code.
 * @template D - The type of the error details (optional).
 */
export class ApiError<T extends string, D = undefined | ApiErrorDetails> implements ApiError<T, D> {
  /**
   * @param {T} code - The error code.
   * @param {D} details - Additional details about the error.
   * @param {string} message - A descriptive error message.
   * @param {string | undefined} requestId - Backend request identifier if provided.
   */
  constructor(
    public code: T,
    public details: D,
    public message: string,
    public requestId?: string
  ) {}

  /**
   * Gets the type of the error from the code.
   * @returns ApiErrorType - The type of the error (e.g., 'auth', 'access').
   */
  getType(): ApiErrorType {
    const splitCode = this.code.split('.')
    const type = splitCode[0] as ApiErrorType

    return type
  }

  /**
   * Checks if the error is an unexpected error.
   * @returns True if the error is of type UnexpectedApiError.
   */
  isServerError(): this is SeverApiError<string, D> {
    return this.isTypeOf('server')
  }

  /**
   * Checks if the error is an auth error.
   * @returns True if the error is of type AuthApiError.
   */
  isAuthError(): this is AuthApiError<string, D> {
    return this.isTypeOf('auth')
  }

  /**
   * Checks if the error is a rate limit error.
   * @returns True if the error is of type RateLimitApiError.
   */
  isRateLimitError(): this is TooManyRequestsApiError {
    return this.isTypeOf('rate_limit')
  }

  /**
   * Checks if the error is an access error.
   * @returns True if the error is of type AccessApiError.
   */
  isAccessError(): this is AccessApiError<string, D> {
    return this.isTypeOf('access')
  }

  /**
   * Checks if the error is a validation error.
   * @returns True if the error is of type ValidationApiError.
   */
  isValidationError(): this is ValidationApiError<string, D> {
    return this.isTypeOf('validation')
  }

  /**
   * Checks if the error is a resource error.
   * @returns True if the error is of type ResourceApiError.
   */
  isResourceError(): this is ResourceApiError<string, D> {
    return this.isTypeOf('resource')
  }

  /**
   * Checks if the error is a conflict error.
   * @returns True if the error is of type ConflictApiError.
   */
  isConflictError(): this is ConflictApiError<string, D> {
    return this.isTypeOf('conflict')
  }

  /**
   * Checks if the error is a quota limit error.
   * @returns True if the error is of type QuotaLimitApiError.
   */
  isQuotaError(): this is QuotaLimitApiError<string, D> {
    return this.isTypeOf('quota')
  }

  /**
   * Checks if the error is of a specific type.
   * @param {E} type - The type to check against.
   * @returns True if the error is of the specified type.
   */
  isTypeOf<E extends ApiErrorType>(type: E): this is ExtractApiError<E> {
    return this.getType() === type
  }
}

export interface ResponseSuccess<T> {
  ok: true
  error: null
  data: T
}

export interface ResponseFailure<K> {
  ok: false
  error: K
  data: null
  // For backward compatibility: body === data
}

// export type ApiResponse<T, K extends { code: string }> = ResponseSuccess<T> | ResponseFailure<K>
export type ApiResponse<T, K = undefined> = ResponseSuccess<T> | ResponseFailure<K>

export const responseSuccess = <T>(data: T): ResponseSuccess<T> => {
  return {
    ok: true,
    error: null,
    data,
  }
}

export const responseFailure = <K>(error: K): ResponseFailure<K> => {
  return {
    ok: false,
    data: null,
    error,
  }
}
