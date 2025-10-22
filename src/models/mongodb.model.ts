import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';

export enum TagEnum {
  PRICING_TABLE_ADDED = 'PRICING_TABLE_ADDED',
  PRICING_TABLE_UPDATED = 'PRICING_TABLE_UPDATED',
  CALCULATION_FORMULA_RULE_ADDED = 'CALCULATION_FORMULA_RULE_ADDED',
  CALCULATION_FORMULA_RULE_UPDATED = 'CALCULATION_FORMULA_RULE_UPDATED',
  NEW_PROMOTION = 'NEW_PROMOTION'
}

export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE_GENAI = 'google-genai',
  AZURE_OPENAI = 'azure_openai'
}

export enum SubscriptionPlan {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  TRIAL = 'trial'
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

export class Subscription {
  @ApiProperty({ enum: SubscriptionPlan, enumName: 'SubscriptionPlan' })
  plan: SubscriptionPlan;

  @ApiProperty({ enum: SubscriptionStatus, enumName: 'SubscriptionStatus' })
  status: SubscriptionStatus;

  @ApiProperty({ type: Date })
  startDate: Date;

  @ApiProperty({ type: Date, required: false })
  endDate?: Date;

  @ApiProperty({ enum: BillingCycle, enumName: 'BillingCycle' })
  billingCycle: BillingCycle;

  @ApiProperty({ type: Number, required: false })
  maxUsers?: number;

  @ApiProperty({ type: Number, required: false })
  maxApiKeys?: number;

  @ApiProperty({ type: [String], required: false })
  featuresEnabled?: string[];
}

export class LLMConfiguration {
  @ApiProperty({ enum: LLMProvider, enumName: 'LLMProvider' })
  provider: LLMProvider;

  @ApiProperty({ type: String })
  model: string;

  @ApiProperty({ type: String })
  apiKey: string;

  @ApiProperty({ type: String, required: false })
  baseUrl?: string; // For custom endpoints like Azure OpenAI

  @ApiProperty({ type: Object, required: false })
  additionalConfig?: Record<string, any>; // For provider-specific configuration

  @ApiProperty({ type: Boolean })
  useByok: boolean;
}

export class Tenant {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String, required: false })
  description?: string;

  @ApiProperty({ type: Boolean, default: true })
  isActive: boolean;

  @ApiProperty({ type: Subscription, required: false })
  subscription?: Subscription;

  @ApiProperty({ type: LLMConfiguration, required: false })
  builderLlmConfiguration?: LLMConfiguration;

  @ApiProperty({ type: LLMConfiguration, required: false })
  chatbotLlmConfiguration?: LLMConfiguration;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date, required: false })
  updatedAt?: Date;

  @ApiProperty({ type: Date, required: false })
  deletedAt?: Date | null;
}

export class User {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;

  @ApiProperty({ type: String })
  firebaseId: string; // Reference to Firebase user ID

  @ApiProperty({ type: String })
  email: string;

  @ApiProperty({ type: String, required: false })
  role?: string;

  @ApiProperty({ type: String, required: false })
  selectedTenantId?: string; // Currently selected tenant ID

  @ApiProperty({ type: Boolean, default: true })
  isActive: boolean;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date, required: false })
  updatedAt?: Date;

  @ApiProperty({ type: Date, required: false })
  deletedAt?: Date | null;
}

export class UserTenant {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;

  @ApiProperty({ type: String, format: 'uuid' })
  userId: ObjectId;

  @ApiProperty({ type: String, format: 'uuid' })
  tenantId: ObjectId;

  @ApiProperty({ type: String, enum: ['admin', 'member'], default: 'member' })
  role: 'admin' | 'member'; // Role within the tenant

  @ApiProperty({ type: Date })
  assignedAt: Date;

  @ApiProperty({ type: Date, required: false })
  removedAt?: Date | null;
}

export class PricingAgentCheckpoint {

  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;

  @ApiProperty({ type: String, format: 'uuid' })
  pricingAgentId: ObjectId; // Reference to the pricing agent
  tenantId?: string; // Made optional for single-tenant mode
  
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
  isDeployed: boolean;
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
  INCORRECT_INPUT_VALUE = 'INCORRECT_INPUT_VALUE',
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

export class ApiKey {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  key: string; // Hashed API key

  @ApiProperty({ type: String, format: 'uuid' })
  tenantId: ObjectId;

  @ApiProperty({ type: Boolean, default: true })
  isActive: boolean;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date, required: false })
  lastUsedAt?: Date;

  @ApiProperty({ type: Date, required: false })
  expiresAt?: Date;

  @ApiProperty({ type: Date, required: false })
  deletedAt?: Date | null;
}
