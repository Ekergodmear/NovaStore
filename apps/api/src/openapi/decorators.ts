import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { ref, type OpenApiComponentName } from './schemas';

const PROBLEM_DESCRIPTIONS: Record<number, string> = {
  400: 'Dữ liệu không hợp lệ (VALIDATION_FAILED, AGREEMENT_VERSION_MISMATCH, PACKAGE_NAME_RESERVED, INVALID_CATEGORY)',
  401: 'Thiếu hoặc sai access token',
  403: 'Không đủ quyền (FORBIDDEN, MFA_REQUIRED, DEVELOPER_* , CONFLICT_OF_INTEREST)',
  404: 'Không tồn tại hoặc không thuộc developer hiện tại',
  409: 'Xung đột (DEVELOPER_ACCOUNT_EXISTS, DEVELOPER_SLUG_TAKEN, INVALID_STATUS_TRANSITION, PACKAGE_NAME_TAKEN, APP_NOT_EDITABLE, INVALID_APP_STATUS_TRANSITION, CATEGORY_SLUG_TAKEN, CATEGORY_IN_USE)',
  429: 'Vượt rate limit',
};

/** Body request theo component schema sinh từ Zod. */
export const ApiJsonBody = (name: OpenApiComponentName) =>
  ApiBody({ schema: ref(name), required: true });

/** Phản hồi thành công + các mã lỗi Problem Details có thể gặp. */
export const ApiJsonResponses = (
  success: { status: number; schema?: OpenApiComponentName; description: string },
  errors: number[],
) =>
  applyDecorators(
    ApiResponse({
      status: success.status,
      description: success.description,
      ...(success.schema && { schema: ref(success.schema) }),
    }),
    ...errors.map((status) =>
      ApiResponse({
        status,
        description: PROBLEM_DESCRIPTIONS[status] ?? 'Lỗi',
        content: { 'application/problem+json': { schema: ref('ProblemDetails') } },
      }),
    ),
  );
