import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableShutdownHooks();
  console.log('[Chuipo] 봇이 실행되었습니다.');
}

bootstrap().catch((err) => {
  console.error('[Chuipo] 시작 실패:', err);
  process.exit(1);
});
