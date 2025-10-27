import { Injectable, Logger } from '@nestjs/common';
import { createGenerator } from 'ts-json-schema-generator';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
}

@Injectable()
export class OpenApiGeneratorService {
  private readonly logger = new Logger(OpenApiGeneratorService.name);

  /**
   * Generates an OpenAPI specification for the calculatePrice endpoint
   * with proper JSON schema for the request body based on a TypeScript interface string
   */
  async generateOrderOpenApiSchema(
    interfaceString: string,
    endpointPath: string = '/integrations/{agentId}/price',
    method: string = 'post'
  ): Promise<OpenApiSpec> {
    try {
      this.logger.log('Generating OpenAPI schema from TypeScript interface');

      // Create a temporary TypeScript file with the interface
      const tempFilePath = this.createTemporaryTypeScriptFile(interfaceString);

      try {
        // Generate JSON schema from the TypeScript interface
        const schema = this.generateJsonSchemaFromFile(tempFilePath);

        // Build the complete OpenAPI specification
        const openApiSpec = this.buildOpenApiSpec(schema, endpointPath, method);

        this.logger.log('Successfully generated OpenAPI schema');
        return openApiSpec;
      } finally {
        // Clean up temporary file
        this.cleanupTemporaryFile(tempFilePath);
      }
    } catch (error) {
      this.logger.error(`Failed to generate OpenAPI schema: ${error.message}`, error.stack);
      throw error;
    }
  }

  private createTemporaryTypeScriptFile(interfaceString: string): string {
    // Create a complete TypeScript module with the interface
    const tsContent = `
export interface OrderInput ${interfaceString}

// Export the interface as default for schema generation
export default OrderInput;
`;

    // Generate a unique temporary file name
    const tempFileName = `order-interface-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.ts`;
    const tempFilePath = join(tmpdir(), tempFileName);

    // Write the content to the temporary file
    writeFileSync(tempFilePath, tsContent, 'utf8');

    this.logger.debug(`Created temporary TypeScript file: ${tempFilePath}`);
    return tempFilePath;
  }

  private generateJsonSchemaFromFile(filePath: string): any {
    const config = {
      path: filePath,
      tsconfig: './tsconfig.json',
      type: 'OrderInput', // The interface name we defined
      expose: 'export' as const,
      jsDoc: 'extended' as const,
      skipTypeCheck: true, // Skip type checking for temporary files
    };

    const generator = createGenerator(config);
    const schema = generator.createSchema(config.type);

    return schema;
  }

  private buildOpenApiSpec(schema: any, endpointPath: string, method: string): OpenApiSpec {
    const openApiSpec: OpenApiSpec = {
      openapi: '3.0.3',
      info: {
        title: 'QuotyAI Integration API',
        version: '1.0.0',
        description: 'Dynamic pricing calculation API for QuotyAI agents',
      },
      paths: {
        [endpointPath]: {
          [method]: {
            summary: 'Calculate price using agent schema parameters',
            description: 'Calculate pricing based on the provided order parameters using a deployed pricing agent',
            parameters: [
              {
                name: 'agentId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                  format: 'uuid',
                },
                description: 'The ID of the pricing agent',
              },
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: schema, // Use the generated JSON schema
                },
              },
            },
            responses: {
              '200': {
                description: 'Price calculated successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        total: {
                          type: 'number',
                          description: 'The calculated total price',
                        },
                        pricingCalculationBacktrace: {
                          type: 'object',
                          description: 'Detailed calculation steps',
                          properties: {
                            operation: { type: 'string' },
                            description: { type: 'string' },
                            subTasks: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/BacktraceCalculationStep' },
                            },
                          },
                        },
                        errors: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              code: { type: 'string' },
                              message: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              '400': {
                description: 'Bad request - invalid parameters or agent not deployed',
              },
              '404': {
                description: 'Pricing agent or checkpoint not found',
              },
              '500': {
                description: 'Internal server error',
              },
            },
            security: [
              {
                bearerAuth: [],
              },
            ],
          },
        },
      },
      components: {
        schemas: {
          BacktraceCalculationStep: {
            type: 'object',
            properties: {
              operation: { type: 'string' },
              description: { type: 'string' },
              subTasks: {
                type: 'array',
                items: { $ref: '#/components/schemas/BacktraceCalculationStep' },
              },
            },
          },
        },
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    };

    return openApiSpec;
  }

  private cleanupTemporaryFile(filePath: string): void {
    try {
      unlinkSync(filePath);
      this.logger.debug(`Cleaned up temporary file: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup temporary file ${filePath}: ${error.message}`);
    }
  }
}
