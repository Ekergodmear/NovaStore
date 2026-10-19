import { PipeTransform } from '@nestjs/common';
import type { z } from '@novastore/validation';
import { ApiException } from './api-exception';

/** Kiểm tra body/query bằng Zod schema dùng chung trong @novastore/validation. */
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    throw ApiException.badRequest('VALIDATION_FAILED', 'Validation failed', {
      errors: result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    });
  }
}
