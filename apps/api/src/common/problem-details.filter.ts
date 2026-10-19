import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ErrorCode, ProblemDetails } from '@novastore/types';
import * as Sentry from '@sentry/node';
import type { Request, Response } from 'express';
import { ApiException } from './api-exception';

const ERROR_TYPE_BASE = 'https://novastore.dev/errors/';

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

function problem(
  status: number,
  code: string,
  title: string,
  extra: Partial<ProblemDetails> = {},
): ProblemDetails {
  return {
    type: ERROR_TYPE_BASE + code.toLowerCase().replace(/_/g, '-'),
    title,
    status,
    code,
    ...extra,
  };
}

export function toProblemDetails(exception: unknown): ProblemDetails {
  if (exception instanceof ApiException) {
    return problem(exception.getStatus(), exception.code, exception.title, {
      detail: exception.problem.detail,
      errors: exception.problem.errors,
    });
  }

  if (exception instanceof ThrottlerException) {
    return problem(429, 'RATE_LIMITED', 'Too many requests');
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code = CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
    // Không lộ chi tiết nội bộ cho lỗi 5xx.
    const detail = status < 500 ? exception.message : undefined;
    return problem(status, code, httpTitle(status), { detail });
  }

  // Lỗi từ middleware Express (vd. body-parser) mang `status` 4xx.
  const status = (exception as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return problem(status, CODE_BY_STATUS[status] ?? 'BAD_REQUEST', httpTitle(status));
  }

  return problem(500, 'INTERNAL_ERROR', 'Internal server error');
}

function httpTitle(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request';
    case 401:
      return 'Authentication required';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not found';
    case 409:
      return 'Conflict';
    case 413:
      return 'Payload too large';
    case 429:
      return 'Too many requests';
    case 503:
      return 'Service unavailable';
    default:
      return status >= 500 ? 'Internal server error' : 'Request error';
  }
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();

    const body = toProblemDetails(exception);
    body.requestId = request.id ? String(request.id) : undefined;

    if (body.status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      Sentry.captureException(exception, { tags: { requestId: body.requestId } });
    }

    if (body.status === 429) {
      response.setHeader('Retry-After', '60');
    }

    response.status(body.status).type('application/problem+json').json(body);
  }
}
