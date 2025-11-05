// src/utils/errors.ts
export interface AppError extends Error {
  code?: string;
  details?: unknown;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Error desconocido';
}

export function createAppError(message: string, code?: string, details?: unknown): AppError {
  const error = new Error(message) as AppError;
  error.code = code;
  error.details = details;
  return error;
}
