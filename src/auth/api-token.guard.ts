import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthUser } from './auth-provider.interface';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No API token provided');
    }

    try {
      const user = await this.authService.verifyToken(token, 'api-token');
      request.user = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid API token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
