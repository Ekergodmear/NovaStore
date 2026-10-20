import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { OPENAPI_COMPONENT_SCHEMAS } from './schemas';

export const OPENAPI_JSON_PATH = 'api/openapi.json';
export const OPENAPI_UI_PATH = 'api/docs';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('NovaStore API')
    .setDescription(
      'API của NovaStore. Mọi route mặc định yêu cầu Bearer token Supabase; lỗi theo RFC 9457 Problem Details.',
    )
    .setVersion('0.2.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.components = {
    ...document.components,
    schemas: {
      ...document.components?.schemas,
      ...(OPENAPI_COMPONENT_SCHEMAS as NonNullable<OpenAPIObject['components']>['schemas']),
    },
  };
  return document;
}

/** UI tại /api/docs và JSON tại /api/openapi.json (không nằm dưới /api/v1). */
export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup(OPENAPI_UI_PATH, app, () => buildOpenApiDocument(app), {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
  });
}
