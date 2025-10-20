import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DatasetHappyPathTestData, DatasetUnhappyPathTestData } from '../models/mongodb.model';

export class CreateTestingDatasetDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ type: String, required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ type: [DatasetHappyPathTestData], required: false })
  @IsArray()
  @IsOptional()
  happyPathTests?: DatasetHappyPathTestData[];

  @ApiProperty({ type: [DatasetUnhappyPathTestData], required: false })
  @IsArray()
  @IsOptional()
  unhappyPathTests?: DatasetUnhappyPathTestData[];
}
