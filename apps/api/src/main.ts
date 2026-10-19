import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { loadEnv, type Env } from './config/env';
import { ENV } from './config/tokens';

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    // Không có file .env: dùng biến môi trường của tiến trình.
  }

  const bootEnv = loadEnv();
  if (bootEnv.SENTRY_DSN) {
    Sentry.init({
      dsn: bootEnv.SENTRY_DSN,
      environment: bootEnv.NODE_ENV,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const env = app.get<Env>(ENV);
  configureApp(app, env);
  await app.listen(env.PORT);
}

void main();
