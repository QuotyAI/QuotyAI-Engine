import { ApiProperty } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';

export class TenantDto {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String, required: false })
  description?: string;

  @ApiProperty({ type: Boolean, default: true })
  isActive: boolean;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date, required: false })
  updatedAt?: Date;

  @ApiProperty({ type: Date, required: false })
  deletedAt?: Date | null;
}
