import { ApiProperty } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';

export class UserTenantDto {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;

  @ApiProperty({ type: String, format: 'uuid' })
  userId: ObjectId;

  @ApiProperty({ type: String, format: 'uuid' })
  tenantId: ObjectId;

  @ApiProperty({ type: String, enum: ['admin', 'member'], default: 'member' })
  role: 'admin' | 'member';

  @ApiProperty({ type: Date })
  assignedAt: Date;

  @ApiProperty({ type: Date, required: false })
  removedAt?: Date | null;
}
