const { NestFactory } = require('@nestjs/core');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
const { AppModule } = require('./dist/app.module');
const fs = require('fs');
const path = require('path');

async function generateOpenAPI() {
  try {
    console.log('Creating NestJS application instance...');
    const app = await NestFactory.create(AppModule);

    console.log('Setting up Swagger documentation...');
    const config = new DocumentBuilder()
      .setTitle('Pricing Agent Builder API')
      .setDescription('API documentation for the Pricing Agent Builder service')
      .setVersion('1.0')
      .addTag('pricing-agents')
      .addTag('builder')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    console.log('Writing OpenAPI JSON to file...');
    const outputPath = path.join(__dirname, 'openapi.json');
    fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));

    console.log(`OpenAPI JSON generated successfully at: ${outputPath}`);
    console.log(`File size: ${fs.statSync(outputPath).size} bytes`);

    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Error generating OpenAPI JSON:', error);
    process.exit(1);
  }
}

generateOpenAPI();
