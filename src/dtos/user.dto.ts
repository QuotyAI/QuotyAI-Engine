import { ApiProperty } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';

export class UserDto {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;

  @ApiProperty({ type: String })
  firebaseId: string;

  @ApiProperty({ type: String })
  email: string;

  @ApiProperty({ type: String, required: false })
  role?: string;

  @ApiProperty({ type: String, required: false })
  selectedTenantId?: string;

  @ApiProperty({ type: Boolean, default: true })
  isActive: boolean;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date, required: false })
  updatedAt?: Date;

  @ApiProperty({ type: Date, required: false })
  deletedAt?: Date | null;
}
