import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateTenantBasicInfoDto {
  @ApiPropertyOptional({
    description: 'The name of the tenant',
    example: 'My Tenant',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'The description of the tenant',
    example: 'A description of my tenant',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
