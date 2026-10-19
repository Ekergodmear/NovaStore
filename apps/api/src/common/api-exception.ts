import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@novastore/types';

export interface ApiExceptionOptions {
  detail?: string;
  errors?: Array<{ path: string; message: string }>;
}

/** Lỗi nghiệp vụ có mã máy đọc được; ProblemDetailsFilter chuyển thành RFC 9457. */
export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode | (string & {}),
    readonly title: string,
    readonly problem: ApiExceptionOptions = {},
  ) {
    super(title, status);
  }

  static badRequest(code: ErrorCode | (string & {}), title: string, options?: ApiExceptionOptions) {
    return new ApiException(HttpStatus.BAD_REQUEST, code, title, options);
  }

  static unauthenticated(detail?: string) {
    return new ApiException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Authentication required', {
      detail,
    });
  }

  static forbidden(code: ErrorCode | (string & {}) = 'FORBIDDEN', detail?: string) {
    return new ApiException(HttpStatus.FORBIDDEN, code, 'Forbidden', { detail });
  }

  static notFound(detail?: string) {
    return new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found', { detail });
  }

  static conflict(code: ErrorCode | (string & {}), detail?: string) {
    return new ApiException(HttpStatus.CONFLICT, code, 'Conflict', { detail });
  }
}
