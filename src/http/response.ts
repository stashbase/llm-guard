export type OpenErrorCode<TCode extends string> = TCode | (string & {})

export type ApiError<TCode extends string = string> = {
  code: OpenErrorCode<TCode>
  message: string
  details?: unknown
}

export type ApiResponse<TData, TCode extends string = string> = {
  ok: boolean
  data: TData | null
  error: ApiError<TCode> | null
}

export const responseSuccess = <TData, TCode extends string = string>(
  data: TData
): ApiResponse<TData, TCode> => {
  return {
    ok: true,
    data,
    error: null,
  }
}

export const responseFailure = <TData = null, TCode extends string = string>(
  error: ApiError<TCode>
): ApiResponse<TData, TCode> => {
  return {
    ok: false,
    data: null,
    error,
  }
}
