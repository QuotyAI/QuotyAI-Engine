import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger, ClassSerializerInterceptor } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import 'reflect-metadata';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  // Enable global logging
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Enable global validation pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.use(bodyParser.json({limit: '50mb'}));
  app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

  // app.useGlobalInterceptors(
  //   new ClassSerializerInterceptor(app.get(Reflector), {}),
  // );
  
  // Enable CORS for development
  app.enableCors();

  // Setup Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Pricing Agent Builder API')
    .setDescription('API documentation for the Pricing Agent Builder service')
    .setVersion('1.0')
    .addTag('pricing-agents')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();
