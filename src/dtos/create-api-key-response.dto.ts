import { ApiProperty } from '@nestjs/swagger';
import { ApiKey } from '../models/mongodb.model';

export class CreateApiKeyResponseDto {
  @ApiProperty({ type: String })
  key: string;

  @ApiProperty({ type: ApiKey })
  apiKey: ApiKey;
}
