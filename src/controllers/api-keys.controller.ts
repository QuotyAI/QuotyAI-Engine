import { Controller, Post, Get, Put, Delete, Body, Param, Headers, Req, HttpException, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiHeader } from '@nestjs/swagger';
import { ApiKeyService } from '../services/api-key.service';
import { ApiKey } from '../models/mongodb.model';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { CreateApiKeyDto } from '../dtos/create-api-key.dto';
import { UpdateApiKeyDto } from '../dtos/update-api-key.dto';
import { CreateApiKeyResponseDto } from '../dtos/create-api-key-response.dto';

@ApiTags('api-keys')
@Controller('api-keys')
@UseGuards(AuthGuard)
export class ApiKeysController {
  private readonly logger = new Logger(ApiKeysController.name);

  constructor(private readonly apiKeyService: ApiKeyService) {
    this.logger.log('ApiKeysController initialized');
  }

  @Post('')
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 201, description: 'API key created successfully', type: CreateApiKeyResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - missing required parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createApiKey(
    @Body() body: CreateApiKeyDto,
    @Req() request: AuthenticatedRequest,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<CreateApiKeyResponseDto> {
    this.logger.log(`Creating API key: ${body.name} for tenant: ${tenantId}`);

    try {
      if (!body.name) {
        throw new HttpException('name is required', HttpStatus.BAD_REQUEST);
      }

      const targetTenantId = tenantId;
      if (!targetTenantId) {
        throw new HttpException('tenantId is required', HttpStatus.BAD_REQUEST);
      }

      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
      const result = await this.apiKeyService.createApiKey(targetTenantId, body.name, expiresAt);

      this.logger.log(`Successfully created API key: ${body.name}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create API key: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to create API key: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('')
  @ApiOperation({ summary: 'Get all API keys for a tenant' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 200, description: 'API keys retrieved successfully', type: [ApiKey] })
  @ApiResponse({ status: 400, description: 'Bad request - tenantId required in multi-tenant mode' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getApiKeys(
    @Req() request: AuthenticatedRequest,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<ApiKey[]> {
    this.logger.log(`Getting API keys for tenant: ${tenantId}`);

    try {
      const targetTenantId = tenantId;
      if (!targetTenantId) {
        throw new HttpException('tenantId is required', HttpStatus.BAD_REQUEST);
      }

      const apiKeys = await this.apiKeyService.findApiKeys(targetTenantId);
      this.logger.log(`Successfully retrieved ${apiKeys.length} API keys`);
      return apiKeys;
    } catch (error) {
      this.logger.error(`Failed to get API keys: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get API keys: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get a specific API key by ID' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 200, description: 'API key retrieved successfully', type: ApiKey })
  @ApiResponse({ status: 404, description: 'API key not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getApiKey(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<ApiKey> {
    this.logger.log(`Getting API key: ${id} for tenant: ${tenantId}`);

    try {
      const targetTenantId = tenantId;
      if (!targetTenantId) {
        throw new HttpException('tenantId is required', HttpStatus.BAD_REQUEST);
      }

      const apiKey = await this.apiKeyService.findOneApiKey(id, targetTenantId);
      if (!apiKey) {
        throw new HttpException('API key not found', HttpStatus.NOT_FOUND);
      }

      this.logger.log(`Successfully retrieved API key: ${apiKey.name} (${id})`);
      return apiKey;
    } catch (error) {
      this.logger.error(`Failed to get API key ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get API key: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put('/:id')
  @ApiOperation({ summary: 'Update an API key' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 200, description: 'API key updated successfully', type: ApiKey })
  @ApiResponse({ status: 404, description: 'API key not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateApiKey(
    @Param('id') id: string,
    @Body() body: UpdateApiKeyDto,
    @Req() request: AuthenticatedRequest,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<ApiKey> {
    this.logger.log(`Updating API key: ${id} for tenant: ${tenantId}`);

    try {
      const targetTenantId = tenantId;
      if (!targetTenantId) {
        throw new HttpException('tenantId is required', HttpStatus.BAD_REQUEST);
      }

      const updateData: any = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;
      if (body.expiresAt !== undefined) updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;

      const apiKey = await this.apiKeyService.updateApiKey(id, targetTenantId, updateData);
      if (!apiKey) {
        throw new HttpException('API key not found', HttpStatus.NOT_FOUND);
      }

      this.logger.log(`Successfully updated API key: ${apiKey.name} (${id})`);
      return apiKey;
    } catch (error) {
      this.logger.error(`Failed to update API key ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update API key: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Delete an API key' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 200, description: 'API key deleted successfully', schema: { type: 'object', properties: { deleted: { type: 'boolean' } } } })
  @ApiResponse({ status: 404, description: 'API key not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteApiKey(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<{ deleted: boolean }> {
    this.logger.log(`Deleting API key: ${id} for tenant: ${tenantId }`);

    try {
      const targetTenantId = tenantId;
      if (!targetTenantId) {
        throw new HttpException('tenantId is required', HttpStatus.BAD_REQUEST);
      }

      const deleted = await this.apiKeyService.deleteApiKey(id, targetTenantId);
      if (!deleted) {
        throw new HttpException('API key not found', HttpStatus.NOT_FOUND);
      }

      this.logger.log(`Successfully deleted API key: ${id}`);
      return { deleted: true };
    } catch (error) {
      this.logger.error(`Failed to delete API key ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete API key: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
