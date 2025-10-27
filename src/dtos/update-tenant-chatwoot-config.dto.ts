import { IsString, IsOptional } from 'class-validator';

export class UpdateTenantChatwootConfigDto {
  @IsOptional()
  @IsString()
  chatbotApiKey?: string;

  @IsOptional()
  @IsString()
  userApiKey?: string;

  @IsOptional()
  @IsString()
  chatwootHost?: string;
}
