import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';

export enum TagEnum {
  PRICING_TABLE_ADDED = 'PRICING_TABLE_ADDED',
  PRICING_TABLE_UPDATED = 'PRICING_TABLE_UPDATED',
  CALCULATION_FORMULA_RULE_ADDED = 'CALCULATION_FORMULA_RULE_ADDED',
  CALCULATION_FORMULA_RULE_UPDATED = 'CALCULATION_FORMULA_RULE_UPDATED',
  NEW_PROMOTION = 'NEW_PROMOTION'
}

export class PricingAgentCheckpoint {

  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;

  @ApiProperty({ type: String, format: 'uuid' })
  pricingAgentId: ObjectId; // Reference to the pricing agent
  tenantId?: string; // Made optional for single-tenant mode
  version: number;

  humanInputMessages: HumanInputMessage[];
  functionSchema?: string;
  functionCode?: string;

  createdAt: Date;
  deletedAt?: Date | null;

  // when schema or code is updated, a new checkpoint is created
  checkpointTrigger:
    'initial' |
    'input_message_added' |
    'input_message_deleted' |
    'function_order_schema_updated' |
    'function_formula_code_updated';
  checkpointDescription?: string;
}

export class HumanInputMessage {
  id: string;
  message?: string;
  @ApiProperty({ type: [String], enum: TagEnum, enumName: 'TagEnum' })
  tags?: TagEnum[];
  createdAt: Date;
  deletedAt?: Date | null;
}

export class PricingAgent {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;
  tenantId?: string; // Made optional for single-tenant mode
  name: string;
  createdAt: Date;
  deletedAt?: Date | null;
}

export class TestingDataset {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;
  name: string;
  description?: string;
  tenantId?: string; // Made optional for single-tenant mode
  createdAt: Date;
  deletedAt?: Date | null;
}


export class TestingDatasetAssignment {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;
  @ApiProperty({ name: 'pricingAgentId', type: String, format: 'uuid' })
  pricingAgentId: ObjectId;
  @ApiProperty({ name: 'testingDatasetId', type: String, format: 'uuid' })
  testingDatasetId: ObjectId;
  tenantId?: string; // Made optional for single-tenant mode
  assignedAt: Date;
}

export class HappyPathTestData {
  orderInputNaturalLanguage: string;
  expectedTotal: number;
  expectedTotalReasoning: string;
}

export class UnhappyPathTestData {
  orderInputNaturalLanguage: string;
  expectedErrorType: ExpectedErrorType;
  expectedErrorReasoning: string;
}

export class DatasetHappyPathTestData {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;
  @ApiProperty({ name: 'testingDatasetId', type: String, format: 'uuid' })
  testingDatasetId: ObjectId;
  tenantId?: string; // Made optional for single-tenant mode
  data: HappyPathTestData;
}

export class DatasetUnhappyPathTestData {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;
  @ApiProperty({ name: 'testingDatasetId', type: String, format: 'uuid' })
  testingDatasetId: ObjectId;
  tenantId?: string; // Made optional for single-tenant mode
  data: UnhappyPathTestData;
}

export class CheckpointHappyPathTestRun {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;
  @ApiProperty({ name: 'checkpointId', type: String, format: 'uuid' })
  checkpointId: ObjectId;
  @ApiProperty({ name: 'datasetId', type: String, format: 'uuid' })
  datasetId: ObjectId;
  @ApiProperty({ name: 'datasetTestId', type: String, format: 'uuid' })
  datasetTestId: ObjectId; // Reference to DatasetHappyPathTestData
  tenantId?: string; // Made optional for single-tenant mode
  createdAt: Date;
  deletedAt?: Date | null;
  functionInputParams: any; // Generated typed input parameters based on the function schema and natural language description
  testRunResult?: TestResult;
}

export class CheckpointUnhappyPathTestRun {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;
  @ApiProperty({ name: 'checkpointId', type: String, format: 'uuid' })
  checkpointId: ObjectId;
  @ApiProperty({ name: 'datasetId', type: String, format: 'uuid' })
  datasetId: ObjectId;
  @ApiProperty({ name: 'datasetTestId', type: String, format: 'uuid' })
  datasetTestId: ObjectId; // Reference to DatasetUnhappyPathTestData
  tenantId?: string; // Made optional for single-tenant mode
  createdAt: Date;
  deletedAt?: Date | null;
  functionInputParams: any; // Generated typed input parameters based on the function schema and natural language description
  testRunResult?: TestResult;
}

export enum ExpectedErrorType {
  NOT_ENOUGH_DATA_TO_QUOTE = 'NOT_ENOUGH_DATA_TO_QUOTE',
  INCORRECT_ORDER_PARAMETER_VALUE = 'INCORRECT_ORDER_PARAMETER_VALUE',
  QUOTATION_RULE_VIOLATION = 'QUOTATION_RULE_VIOLATION'
}

export interface TestResult {
  passed: boolean;
  functionResult?: QuoteResult;
  runnerException?: any;
}

export interface QuoteResult {
  total?: number;
  pricingCalculationBacktrace?: BacktraceCalculationStep;
  errors?: QuoteError[];
}

export interface QuoteError {
  code: string;
  message: string;
}

export interface BacktraceCalculationStep {
  operation: string;
  description: string;
  subTasks?: BacktraceCalculationStep[];
}
