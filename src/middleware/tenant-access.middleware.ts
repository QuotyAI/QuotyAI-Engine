import { Injectable, NestMiddleware, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../services/tenant.service';
import { AuthUser } from '../auth/auth-provider.interface';
import { TenantDto } from '../dtos/tenant.dto';

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

interface CachedUserTenants {
  tenants: TenantDto[];
  timestamp: number;
}

@Injectable()
export class TenantAccessMiddleware implements NestMiddleware {
  private readonly cache = new Map<string, CachedUserTenants>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    @Inject(TenantService) private readonly tenantService: TenantService
  ) {}

  private async getUserTenantsCached(userId: string): Promise<TenantDto[]> {
    const now = Date.now();
    const cached = this.cache.get(userId);

    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.tenants;
    }

    // Cache miss or expired, fetch from database
    const tenants = await this.tenantService.getUserTenants(userId);

    // Cache the result
    this.cache.set(userId, {
      tenants,
      timestamp: now
    });

    return tenants;
  }

  // Method to invalidate cache for a specific user (can be called when user tenant assignments change)
  public invalidateUserCache(userId: string): void {
    this.cache.delete(userId);
  }

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;

    // If no tenant ID specified, allow the request (some endpoints might not require tenant context)
    if (!tenantId) {
      return next();
    }

    // If user is not authenticated, let the auth guard handle it
    if (!req.user?.id) {
      return next();
    }

    try {
      // Get the user from database using firebase ID
      const user = await this.tenantService.getUserByFirebaseId(req.user.id);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
      }

      // Check if user has access to the tenant (using cached data)
      const userTenants = await this.getUserTenantsCached(user._id!.toString());
      const hasAccess = userTenants.some(tenant => tenant._id?.toString() === tenantId);

      if (!hasAccess) {
        throw new HttpException('Access denied: User does not have access to this tenant', HttpStatus.FORBIDDEN);
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal server error during tenant access check', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
