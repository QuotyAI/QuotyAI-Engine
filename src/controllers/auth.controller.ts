import { Controller, Post, Body, UseGuards, Req, Get, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantService } from '../services/tenant.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UserDto } from '../dtos/user.dto';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(AuthGuard)
export class AuthController {
  constructor(private readonly tenantService: TenantService) {}

  @Post('users')
  @ApiOperation({ summary: 'Create or get user by Firebase ID' })
  @ApiResponse({ status: 200, description: 'User created or retrieved successfully', type: UserDto })
  async ensureUser(@Body() userData: CreateUserDto): Promise<UserDto> {
    return this.tenantService.ensureUserExists({
      firebaseId: userData.firebaseId,
      email: userData.email,
      role: userData.role || 'admin',
      isActive: true
    });
  }

  @Get('users/me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user details', type: UserDto })
  async getCurrentUser(@Req() request: AuthenticatedRequest): Promise<UserDto> {
    if (!request.user?.id)
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    const firebaseId = request.user.id;
    const user = await this.tenantService.getUserByFirebaseId(firebaseId);
    if (!user) {
      throw new Error('User not found');
    }
    return user as UserDto;
  }


}
