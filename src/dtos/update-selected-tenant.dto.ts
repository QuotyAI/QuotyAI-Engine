import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateSelectedTenantDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;
}
