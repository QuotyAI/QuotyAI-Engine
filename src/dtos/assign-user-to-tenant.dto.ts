import { IsEnum, IsOptional } from 'class-validator';

export class AssignUserToTenantDto {
  @IsEnum(['admin', 'member'])
  @IsOptional()
  role?: 'admin' | 'member';
}
