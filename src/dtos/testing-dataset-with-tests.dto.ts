import { ApiProperty } from '@nestjs/swagger';
import { TestingDataset, DatasetHappyPathTestData, DatasetUnhappyPathTestData } from '../models/mongodb.model';

export class TestingDatasetWithTestsDto {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String, required: false })
  description?: string;

  @ApiProperty({ type: String })
  tenantId: string;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date, required: false })
  deletedAt?: Date | null;

  @ApiProperty({ type: [DatasetHappyPathTestData], required: false })
  happyPathTests?: DatasetHappyPathTestData[];

  @ApiProperty({ type: [DatasetUnhappyPathTestData], required: false })
  unhappyPathTests?: DatasetUnhappyPathTestData[];
}
