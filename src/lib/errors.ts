// Custom application error class
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, code = "BAD_REQUEST", details?: unknown): AppError {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = "Authentication required", code = "UNAUTHORIZED"): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(message = "You are not allowed to perform this action", code = "FORBIDDEN"): AppError {
    return new AppError(403, code, message);
  }

  static notFound(message: string, code = "NOT_FOUND"): AppError {
    return new AppError(404, code, message);
  }

  static conflict(message: string, code = "CONFLICT", details?: unknown): AppError {
    return new AppError(409, code, message, details);
  }

  static unprocessable(message: string, code = "UNPROCESSABLE_ENTITY", details?: unknown): AppError {
    return new AppError(422, code, message, details);
  }

  static internal(message = "Internal server error", code = "INTERNAL_SERVER_ERROR"): AppError {
    return new AppError(500, code, message);
  }
}
