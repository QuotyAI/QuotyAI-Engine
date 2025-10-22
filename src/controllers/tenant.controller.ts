import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantService } from '../services/tenant.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateTenantDto } from '../dtos/create-tenant.dto';
import { UpdateTenantDto } from '../dtos/update-tenant.dto';
import { AssignUserToTenantDto } from '../dtos/assign-user-to-tenant.dto';
import { UpdateSelectedTenantDto } from '../dtos/update-selected-tenant.dto';
import { SuccessResponseDto } from '../dtos/success-response.dto';
import { TenantDto } from '../dtos/tenant.dto';
import { UserDto } from '../dtos/user.dto';
import { UserTenantDto } from '../dtos/user-tenant.dto';
import { LLMConfigurationDto } from '../dtos/llm-configuration.dto';
import { UpdateTenantBasicInfoDto } from '../dtos/update-tenant-basic-info.dto';
import { UpdateTenantBuilderLlmConfigDto } from '../dtos/update-tenant-builder-llm-config.dto';
import { UpdateTenantChatbotLlmConfigDto } from '../dtos/update-tenant-chatbot-llm-config.dto';
import type { AuthenticatedRequest } from '../auth/auth.guard';

@ApiTags('User Tenants')
@Controller('user-tenants')
@UseGuards(AuthGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post('tenants')
  @ApiOperation({ summary: 'Create a new tenant for user' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully', type: TenantDto })
  async createUserTenant(@Body() tenantData: CreateTenantDto): Promise<TenantDto> {
    return this.tenantService.createTenant({
      name: tenantData.name,
      description: tenantData.description,
      isActive: tenantData.isActive ?? true
    });
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Get all tenants' })
  @ApiResponse({ status: 200, description: 'List of all tenants', type: [TenantDto] })
  async getAllUserTenants(): Promise<TenantDto[]> {
    return this.tenantService.getAllTenants();
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'Tenant details', type: TenantDto })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getUserTenantById(@Param('id') tenantId: string): Promise<TenantDto | null> {
    return this.tenantService.getTenantById(tenantId);
  }

  // Specific update endpoints
  @Put('tenants/:id/basic-info')
  @ApiOperation({ summary: 'Update tenant basic information (name and description)' })
  @ApiResponse({ status: 200, description: 'Tenant basic info updated successfully', type: TenantDto })
  async updateTenantBasicInfo(
    @Param('id') tenantId: string,
    @Body() body: UpdateTenantBasicInfoDto
  ): Promise<TenantDto | null> {
    return this.tenantService.updateTenantBasicInfo(tenantId, body);
  }



  @Put('tenants/:id/builder-llm-config')
  @ApiOperation({ summary: 'Update tenant builder LLM configuration' })
  @ApiResponse({ status: 200, description: 'Builder LLM configuration updated successfully', type: TenantDto })
  async updateTenantBuilderLlmConfig(
    @Param('id') tenantId: string,
    @Body() body: UpdateTenantBuilderLlmConfigDto
  ): Promise<TenantDto | null> {
    return this.tenantService.updateTenantBuilderLlmConfig(tenantId, body.builderLlmConfiguration);
  }

  @Put('tenants/:id/chatbot-llm-config')
  @ApiOperation({ summary: 'Update tenant chatbot LLM configuration' })
  @ApiResponse({ status: 200, description: 'Chatbot LLM configuration updated successfully', type: TenantDto })
  async updateTenantChatbotLlmConfig(
    @Param('id') tenantId: string,
    @Body() body: UpdateTenantChatbotLlmConfigDto
  ): Promise<TenantDto | null> {
    return this.tenantService.updateTenantChatbotLlmConfig(tenantId, body.chatbotLlmConfiguration);
  }

  // Keep the general update endpoint for backward compatibility
  @Put('tenants/:id')
  @ApiOperation({ summary: 'Update tenant (deprecated - use specific endpoints)' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully', type: TenantDto })
  async updateUserTenant(
    @Param('id') tenantId: string,
    @Body() updateData: UpdateTenantDto
  ): Promise<TenantDto | null> {
    return this.tenantService.updateTenant(tenantId, updateData);
  }

  @Delete('tenants/:id')
  @ApiOperation({ summary: 'Delete tenant (soft delete)' })
  @ApiResponse({ status: 200, description: 'Tenant deleted successfully', type: SuccessResponseDto })
  async deleteUserTenant(@Param('id') tenantId: string): Promise<SuccessResponseDto> {
    const success = await this.tenantService.deleteTenant(tenantId);
    return { success };
  }

  // User-Tenant relationship endpoints
  @Post(':tenantId/users')
  @ApiOperation({ summary: 'Assign authenticated user to tenant' })
  @ApiResponse({ status: 201, description: 'User assigned to tenant successfully', type: UserTenantDto })
  async assignUserToTenant(
    @Param('tenantId') tenantId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: AssignUserToTenantDto
  ): Promise<UserTenantDto> {
    if (!request.user?.id)
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    const firebaseId = request.user.id;
    const user = await this.tenantService.getUserByFirebaseId(firebaseId);
    if (!user) {
      throw new Error('User not found');
    }
    return this.tenantService.assignUserToTenant(user._id!.toString(), tenantId, body.role);
  }

  @Delete(':tenantId/users')
  @ApiOperation({ summary: 'Remove authenticated user from tenant' })
  @ApiResponse({ status: 200, description: 'User removed from tenant successfully', type: SuccessResponseDto })
  async removeUserFromTenant(
    @Param('tenantId') tenantId: string,
    @Req() request: AuthenticatedRequest
  ): Promise<SuccessResponseDto> {
    if (!request.user?.id)
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    const firebaseId = request.user.id;
    const user = await this.tenantService.getUserByFirebaseId(firebaseId);
    if (!user) {
      throw new Error('User not found');
    }
    const success = await this.tenantService.removeUserFromTenant(user._id!.toString(), tenantId);
    return { success };
  }

  @Get(':tenantId/users')
  @ApiOperation({ summary: 'Get all users for a tenant' })
  @ApiResponse({ status: 200, description: 'List of users in the tenant', type: [UserDto] })
  async getTenantUsers(@Param('tenantId') tenantId: string): Promise<UserDto[]> {
    return this.tenantService.getTenantUsers(tenantId);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Get all tenants for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of tenants for the authenticated user', type: [TenantDto] })
  async getUserTenants(@Req() request: AuthenticatedRequest): Promise<TenantDto[]> {
    if (!request.user?.id)
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    const firebaseId = request.user.id;
    const user = await this.tenantService.getUserByFirebaseId(firebaseId);
    if (!user) {
      throw new Error('User not found');
    }
    return this.tenantService.getUserTenants(user._id!.toString());
  }

  @Post('users/selected-tenant')
  @ApiOperation({ summary: 'Update selected tenant for authenticated user' })
  @ApiResponse({ status: 200, description: 'Selected tenant updated successfully', type: UserDto })
  async updateSelectedTenant(@Req() request: AuthenticatedRequest, @Body() body: UpdateSelectedTenantDto): Promise<UserDto | null> {
    if (!request.user?.id)
          throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    const firebaseId = request.user.id;
    return this.tenantService.updateUserSelectedTenant(firebaseId, body.tenantId);
  }
}
