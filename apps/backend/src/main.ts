import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Set global prefix
  app.setGlobalPrefix('api');

  // Enable CORS
  app.enableCors();

  // Swagger Setup
  const config = new DocumentBuilder()
    .setTitle('Geomesh API')
    .setDescription(
      'Platform Asset Tracking Multi‑Tenant Industri (Wirepas + Teltonika) API Documentation',
    )
    .setVersion('1.0')
    .addTag('tenants', 'Operations related to SaaS Tenants')
    .addTag('sites', 'Operations related to Site Cabang')
    .addTag('zones', 'Operations related to Floor Plan Zones')
    .addTag('assets', 'Operations related to Industrial Assets')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}/api`);
  logger.log(`API documentation is available at: http://localhost:${port}/api/docs`);
}
bootstrap();
