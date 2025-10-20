import { ApiProperty } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';
import { BacktraceCalculationStep, HappyPathTestData, QuoteError, QuoteResult, TestResult, UnhappyPathTestData } from '../models/mongodb.model';

export class TestResultDTO implements TestResult {
  passed: boolean;
  functionResult?: QuoteResultDTO;
  runnerException?: any;
}

export class QuoteResultDTO implements QuoteResult {
  total?: number;
  pricingCalculationBacktrace?: BacktraceCalculationStepDTO;
  errors?: QuoteErrorDTO[];
}

export class QuoteErrorDTO implements QuoteError{
  code: string;
  message: string;
}

export class BacktraceCalculationStepDTO implements BacktraceCalculationStep{
  operation: string;
  description: string;
  subTasks?: BacktraceCalculationStepDTO[];
}


export class CheckpointHappyPathTestWithData {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;

  @ApiProperty({ name: 'checkpointId', type: String, format: 'uuid' })
  checkpointId: ObjectId;

  @ApiProperty({ name: 'datasetId', type: String, format: 'uuid' })
  datasetId: ObjectId;
  
  @ApiProperty({ name: 'datasetTestId', type: String, format: 'uuid' })
  datasetTestId: ObjectId;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Object })
  functionInputParams: any;

  @ApiProperty({ type: TestResultDTO, required: false })
  testRunResult?: TestResultDTO;

  @ApiProperty({ type: HappyPathTestData })
  testData: HappyPathTestData;
}

export class CheckpointUnhappyPathTestWithData {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;

  @ApiProperty({ name: 'checkpointId', type: String, format: 'uuid' })
  checkpointId: ObjectId;
  
  @ApiProperty({ name: 'datasetId', type: String, format: 'uuid' })
  datasetId: ObjectId;

  @ApiProperty({ name: 'datasetTestId', type: String, format: 'uuid' })
  datasetTestId: ObjectId;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Object })
  functionInputParams: any;

  @ApiProperty({ type: TestResultDTO, required: false })
  testRunResult?: TestResultDTO;

  @ApiProperty({ type: UnhappyPathTestData })
  testData: UnhappyPathTestData;
}

export class CheckpointTestsetDto {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;

  @ApiProperty({ type: String, format: 'uuid' })
  checkpointId: ObjectId;

  @ApiProperty({ type: [CheckpointHappyPathTestWithData] })
  happyPathTests?: CheckpointHappyPathTestWithData[];

  @ApiProperty({ type: [CheckpointUnhappyPathTestWithData] })
  unhappyPathTests?: CheckpointUnhappyPathTestWithData[];
}
