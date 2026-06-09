// src/types/api.types.ts
export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  data: T;
  success: true;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
