import { Injectable, Inject, Logger } from '@nestjs/common';
import { Db, ObjectId, Filter } from 'mongodb';
import {
  TestingDataset,
  TestingDatasetAssignment,
  DatasetHappyPathTestData,
  DatasetUnhappyPathTestData,
  CheckpointHappyPathTestRun,
  CheckpointUnhappyPathTestRun,
  PricingAgentCheckpoint,
} from '../models/mongodb.model';
import { CheckpointTestsetDto, CheckpointHappyPathTestWithData, CheckpointUnhappyPathTestWithData } from '../dtos/checkpoint-testset.dto';
import { AiHappyPathDatasetGenerationAgentService } from '../ai-agents/ai-happy-path-dataset-generation.agent';
import { AiUnhappyPathDatasetGenerationAgentService } from 'src/ai-agents/ai-unhappy-path-tests-generation.agent';
import { AiTestsetGenerationAgentService } from '../ai-agents/ai-testset-generator.agent';
import { DynamicRunnerService } from './dynamic-runner.service';
import { TestingDatasetWithTestsDto } from 'src/dtos/testing-dataset-with-tests.dto';

type TestingDatasetFilter = Filter<TestingDataset>;
type TestingDatasetAssignmentFilter = Filter<TestingDatasetAssignment>;
type DatasetHappyPathTestFilter = Filter<DatasetHappyPathTestData>;
type DatasetUnhappyPathTestFilter = Filter<DatasetUnhappyPathTestData>;
type CheckpointHappyPathTestFilter = Filter<CheckpointHappyPathTestRun>;
type CheckpointUnhappyPathTestFilter = Filter<CheckpointUnhappyPathTestRun>;
type SearchCriteria = {
  checkpointId?: string;
  tenantId?: string;
  name?: string;
  description?: string;
  limit?: number;
};

@Injectable()
export class TestingDatasetService {
  private readonly logger = new Logger(TestingDatasetService.name);

  constructor(
    @Inject('DATABASE_CONNECTION') private db: Db,
    private readonly aiHappyPathDatasetGenerationAgent: AiHappyPathDatasetGenerationAgentService,
    private readonly aiUnhappyPathDatasetGenerationAgent: AiUnhappyPathDatasetGenerationAgentService,
    private readonly aiTestsetGenerationAgent: AiTestsetGenerationAgentService,
    private readonly dynamicRunnerService: DynamicRunnerService,
  ) {
    this.logger.log('TestingDatasetService initialized');
  }

  private get testingDatasetCollection() {
    return this.db.collection<TestingDataset>('testing-datasets');
  }

  private get datasetHappyPathTestCollection() {
    return this.db.collection<DatasetHappyPathTestData>('dataset-happy-path-tests');
  }

  private get datasetUnhappyPathTestCollection() {
    return this.db.collection<DatasetUnhappyPathTestData>('dataset-unhappy-path-tests');
  }

  private get checkpointHappyPathTestCollection() {
    return this.db.collection<CheckpointHappyPathTestRun>('checkpoint-happy-path-test-runs');
  }

  private get checkpointUnhappyPathTestCollection() {
    return this.db.collection<CheckpointUnhappyPathTestRun>('checkpoint-unhappy-path-test-runs');
  }

  private get testingDatasetAssignmentCollection() {
    return this.db.collection<TestingDatasetAssignment>('testing-dataset-assignments');
  }

  private buildTestingDatasetFilter(tenantId?: string, additionalFilters: Partial<TestingDatasetFilter> = {}): TestingDatasetFilter {
    const filter: TestingDatasetFilter = { deletedAt: null, ...additionalFilters };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return filter;
  }

  private buildTestingDatasetAssignmentFilter(tenantId?: string, additionalFilters: Partial<TestingDatasetAssignmentFilter> = {}): TestingDatasetAssignmentFilter {
    const filter: TestingDatasetAssignmentFilter = { ...additionalFilters };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return filter;
  }

  private buildDatasetHappyPathTestFilter(tenantId?: string, additionalFilters: Partial<DatasetHappyPathTestFilter> = {}): DatasetHappyPathTestFilter {
    const filter: DatasetHappyPathTestFilter = { deletedAt: null, ...additionalFilters };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return filter;
  }

  private buildDatasetUnhappyPathTestFilter(tenantId?: string, additionalFilters: Partial<DatasetUnhappyPathTestFilter> = {}): DatasetUnhappyPathTestFilter {
    const filter: DatasetUnhappyPathTestFilter = { deletedAt: null, ...additionalFilters };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return filter;
  }

  private buildCheckpointHappyPathTestFilter(tenantId?: string, additionalFilters: Partial<CheckpointHappyPathTestFilter> = {}): CheckpointHappyPathTestFilter {
    const filter: CheckpointHappyPathTestFilter = { deletedAt: null, ...additionalFilters };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return filter;
  }

  private buildCheckpointUnhappyPathTestFilter(tenantId?: string, additionalFilters: Partial<CheckpointUnhappyPathTestFilter> = {}): CheckpointUnhappyPathTestFilter {
    const filter: CheckpointUnhappyPathTestFilter = { deletedAt: null, ...additionalFilters };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return filter;
  }

  private extractPricingDescription(checkpoint: PricingAgentCheckpoint): string {
    return checkpoint.humanInputMessages
      .map(msg => msg.message || '')
      .filter(msg => msg.trim())
      .join('\n');
  }

  async aiGenerateDataset(checkpoint: PricingAgentCheckpoint, agentName: string): Promise<TestingDataset> {
    this.logger.log(`AI generating checkpoint dataset for checkpoint: ${checkpoint._id}`);

    if (!checkpoint.functionSchema || !checkpoint.functionCode) {
      throw new Error('Checkpoint must have both functionSchema and functionCode to generate tests');
    }

    const pricingDescription = this.extractPricingDescription(checkpoint);

    if (!pricingDescription.trim()) {
      throw new Error('No input messages found to generate tests');
    }

    // Generate happy path test scenarios
    const happyPathTests = await this.aiHappyPathDatasetGenerationAgent.generateHappyPathScenarios(
      pricingDescription,
      checkpoint.functionSchema,
      checkpoint.functionCode,
    ) || [];

    // Generate unhappy path test scenarios
    const unhappyPathTests = await this.aiUnhappyPathDatasetGenerationAgent.generateUnhappyPathScenarios(
      pricingDescription,
      checkpoint.functionSchema,
      checkpoint.functionCode,
    ) || [];

    const testingDataset: Omit<TestingDataset, '_id' | 'createdAt'> = {
      name: `Generated Tests for ${agentName} Checkpoint ${checkpoint.version}`,
      description: `Auto-generated test scenarios for pricing agent checkpoint v${checkpoint.version}`,
      tenantId: checkpoint.tenantId,
    };

    const datasetResult = await this.testingDatasetCollection.insertOne({
      ...testingDataset,
      createdAt: new Date(),
    });

    const createdDataset = {
      _id: datasetResult.insertedId,
      ...testingDataset,
      createdAt: new Date(),
    };

    // log the created dataset ID
    this.logger.log(`Created testing dataset with ID: ${createdDataset._id}`);

    // Save generated tests to dataset test collections
    if (happyPathTests.length > 0) {
      const happyPathTestDocs = happyPathTests.map(test => ({
        testingDatasetId: createdDataset._id,
        tenantId: checkpoint.tenantId,
        data: test,
      }));
      await this.datasetHappyPathTestCollection.insertMany(happyPathTestDocs);
      this.logger.log(`Saved ${happyPathTests.length} happy path tests to dataset`);
    }

    if (unhappyPathTests.length > 0) {
      const unhappyPathTestDocs = unhappyPathTests.map(test => ({
        testingDatasetId: createdDataset._id,
        tenantId: checkpoint.tenantId,
        data: test,
      }));
      await this.datasetUnhappyPathTestCollection.insertMany(unhappyPathTestDocs);
      this.logger.log(`Saved ${unhappyPathTests.length} unhappy path tests to dataset`);
    }

    await this.assignTestingDataset(checkpoint.pricingAgentId.toString(), createdDataset._id.toString(), checkpoint.tenantId);

    this.logger.log(`Successfully generated and assigned tests to checkpoint ${checkpoint._id}`);

    return createdDataset;
  }

  async findTestingDatasets(searchCriteria: SearchCriteria): Promise<TestingDataset[]> {
    this.logger.log(`Finding testing datasets with criteria:`, searchCriteria);

    try {
      let filter: TestingDatasetFilter;

      // If checkpointId is provided, get datasets assigned to that checkpoint
      if (searchCriteria.checkpointId) {
        const assignments = await this.testingDatasetAssignmentCollection.find(
          this.buildTestingDatasetAssignmentFilter(searchCriteria.tenantId, {
            pricingAgentId: new ObjectId(searchCriteria.checkpointId)
          })
        ).toArray();

        if (assignments.length === 0) {
          this.logger.log(`No assigned testing datasets for agent: ${searchCriteria.checkpointId}`);
          return [];
        }

        // Get all testing dataset IDs from assignments
        const datasetIds = assignments.map(assignment => assignment.testingDatasetId);
        filter = this.buildTestingDatasetFilter(searchCriteria.tenantId, { _id: { $in: datasetIds } });
      } else {
        filter = this.buildTestingDatasetFilter(searchCriteria.tenantId);
      }

      // Add other search criteria
      if (searchCriteria.name) {
        filter = { ...filter, name: { $regex: searchCriteria.name, $options: 'i' } };
      }

      if (searchCriteria.description) {
        filter = { ...filter, description: { $regex: searchCriteria.description, $options: 'i' } };
      }

      let query = this.testingDatasetCollection.find(filter);

      // Apply limit if specified
      if (searchCriteria.limit && searchCriteria.limit > 0) {
        query = query.limit(searchCriteria.limit);
      }

      const datasets = await query.toArray();

      this.logger.log(`Successfully retrieved ${datasets.length} testing datasets`);
      return datasets;
    } catch (error) {
      this.logger.error(`Failed to find testing datasets: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Testing Dataset CRUD methods
  async createTestingDataset(testingDataset: Omit<TestingDataset, '_id' | 'createdAt'>): Promise<TestingDataset> {
    this.logger.log(`Creating testing dataset: ${testingDataset.name} for tenant: ${testingDataset.tenantId}`);

    try {
      const now = new Date();
      const doc = {
        ...testingDataset,
        createdAt: now,
      };
      const result = await this.testingDatasetCollection.insertOne(doc);

      const createdDataset = {
        _id: result.insertedId,
        ...doc,
      };

      this.logger.log(`Successfully created testing dataset with ID: ${createdDataset._id}`);
      return createdDataset;
    } catch (error) {
      this.logger.error(`Failed to create testing dataset: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOneTestingDataset(id: string, tenantId?: string): Promise<TestingDataset | null> {
    this.logger.log(`Finding testing dataset: ${id} for tenant: ${tenantId}`);

    try {
      const filter = this.buildTestingDatasetFilter(tenantId, { _id: new ObjectId(id) });
      const dataset = await this.testingDatasetCollection.findOne(filter);

      if (dataset) {
        this.logger.log(`Successfully found testing dataset: ${dataset.name} (${id})`);
      } else {
        this.logger.warn(`Testing dataset not found: ${id} for tenant: ${tenantId}`);
      }

      return dataset;
    } catch (error) {
      this.logger.error(`Failed to find testing dataset ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOneTestingDatasetWithTests(id: string, tenantId?: string): Promise<TestingDatasetWithTestsDto> {
    this.logger.log(`Finding testing dataset with tests: ${id} for tenant: ${tenantId}`);

    try {
      const dataset = await this.findOneTestingDataset(id, tenantId);

      if (!dataset) {
        this.logger.warn(`Testing dataset not found: ${id} for tenant: ${tenantId}`);
        throw new Error(`Testing dataset not found: ${id}`);
      }

      // Fetch happy path tests
      const happyPathTests = await this.datasetHappyPathTestCollection.find(
        this.buildDatasetHappyPathTestFilter(tenantId, { testingDatasetId: new ObjectId(id) })
      ).toArray();

      // Fetch unhappy path tests
      const unhappyPathTests = await this.datasetUnhappyPathTestCollection.find(
        this.buildDatasetUnhappyPathTestFilter(tenantId, { testingDatasetId: new ObjectId(id) })
      ).toArray();

      const result: TestingDatasetWithTestsDto = {
        ...dataset,
        _id: dataset._id!.toString(),
        happyPathTests: happyPathTests,
        unhappyPathTests: unhappyPathTests
      };

      this.logger.log(`Successfully found testing dataset with tests: ${dataset.name} (${id})`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to find testing dataset with tests ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateTestingDataset(id: string, updateData: Partial<Omit<TestingDataset, '_id' | 'createdAt'>>, tenantId?: string): Promise<TestingDataset | null> {
    this.logger.log(`Updating testing dataset: ${id} for tenant: ${tenantId}`);

    try {
      const filter = this.buildTestingDatasetFilter(tenantId, { _id: new ObjectId(id) });
      await this.testingDatasetCollection.updateOne(filter, { $set: updateData });
      const updatedDataset = await this.findOneTestingDataset(id, tenantId);

      if (updatedDataset) {
        this.logger.log(`Successfully updated testing dataset: ${updatedDataset.name} (${id})`);
      } else {
        this.logger.warn(`Testing dataset not found after update: ${id} for tenant: ${tenantId}`);
      }

      return updatedDataset;
    } catch (error) {
      this.logger.error(`Failed to update testing dataset ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteTestingDataset(id: string, tenantId?: string): Promise<boolean> {
    this.logger.log(`Soft deleting testing dataset: ${id} for tenant: ${tenantId}`);

    try {
      const filter = this.buildTestingDatasetFilter(tenantId, { _id: new ObjectId(id) });
      const result = await this.testingDatasetCollection.updateOne(filter, { $set: { deletedAt: new Date() } });
      const deleted = result.modifiedCount > 0;

      if (deleted) {
        this.logger.log(`Successfully soft deleted testing dataset: ${id}`);
      } else {
        this.logger.warn(`Testing dataset not found for deletion: ${id} for tenant: ${tenantId}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to soft delete testing dataset ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async aiGenerateTestsetFromAssignedDatasets(checkpoint: PricingAgentCheckpoint) {
    this.logger.log(`AI generating testset from assigned datasets for checkpoint: ${checkpoint._id}`);

    try {
      if (!checkpoint.functionSchema) {
        throw new Error('Checkpoint must have functionSchema to generate testset');
      }

      // Get all assigned testing datasets from the separate collection
      const assignments = await this.testingDatasetAssignmentCollection.find(
        this.buildTestingDatasetAssignmentFilter(checkpoint.tenantId, {
          pricingAgentId: checkpoint.pricingAgentId
        })
      ).toArray();

      if (assignments.length === 0) {
        throw new Error('Checkpoint must have assigned testing datasets to generate testset from');
      }

      // Get all assigned testing datasets
      const assignedDatasetIds = assignments.map(assignment => assignment.testingDatasetId);
      const assignedDatasets = await this.testingDatasetCollection.find(
        this.buildTestingDatasetFilter(checkpoint.tenantId, { _id: { $in: assignedDatasetIds } })
      ).toArray();

      if (assignedDatasets.length === 0) {
        throw new Error('No assigned testing datasets found');
      }

      // Fetch all the test data in bulk from assigned datasets
      const datasetHappyPathTests = await this.datasetHappyPathTestCollection.find(
        this.buildDatasetHappyPathTestFilter(checkpoint.tenantId, { testingDatasetId: { $in: assignedDatasetIds } })
      ).toArray();

      const datasetUnhappyPathTests = await this.datasetUnhappyPathTestCollection.find(
        this.buildDatasetUnhappyPathTestFilter(checkpoint.tenantId, { testingDatasetId: { $in: assignedDatasetIds } })
      ).toArray();

      // Generate structured test cases using AI
      const generatedInputs = await this.aiTestsetGenerationAgent.generateTypedOrderInputs({
        happyPathTests: datasetHappyPathTests,
        unhappyPathTests: datasetUnhappyPathTests,
        checkpoint: checkpoint
      });

      // Remove existing tests for this checkpoint before saving new ones
      await this.checkpointHappyPathTestCollection.deleteMany(
        this.buildCheckpointHappyPathTestFilter(checkpoint.tenantId, { checkpointId: checkpoint._id })
      );

      await this.checkpointUnhappyPathTestCollection.deleteMany(
        this.buildCheckpointUnhappyPathTestFilter(checkpoint.tenantId, { checkpointId: checkpoint._id })
      );

      if (generatedInputs.happyPathTestRuns && generatedInputs.happyPathTestRuns.length > 0) {
        const happyPathInserts = generatedInputs.happyPathTestRuns.map(test => ({
          ...test,
          createdAt: new Date(),
        }));
        const insertResult = await this.checkpointHappyPathTestCollection.insertMany(happyPathInserts);
      }

      if (generatedInputs.unhappyPathTestRuns && generatedInputs.unhappyPathTestRuns.length > 0) {
        const unhappyPathInserts = generatedInputs.unhappyPathTestRuns.map(test => ({
          ...test,
          createdAt: new Date(),
        }));
        const insertResult = await this.checkpointUnhappyPathTestCollection.insertMany(unhappyPathInserts);        
      }

      this.logger.log(`Successfully generated and assigned AI testset to checkpoint ${checkpoint._id}`);
    } catch (error) {
      this.logger.error(`Failed to AI generate testset from assigned datasets for checkpoint ${checkpoint._id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async runCheckpointTestset(
    checkpoint: PricingAgentCheckpoint,
    failFast: boolean = false
  ): Promise<void> {
    this.logger.log(`Running checkpoint testset for checkpoint: ${checkpoint._id}, failFast: ${failFast}`);

    try {
      // Check if checkpoint has function code
      if (!checkpoint.functionCode) {
        throw new Error('Checkpoint must have functionCode to run tests');
      }

      // Get test runs from separate collections
      const happyPathTestRuns = await this.checkpointHappyPathTestCollection.find(
        this.buildCheckpointHappyPathTestFilter(checkpoint.tenantId, { checkpointId: checkpoint._id })
      ).toArray();

      const unhappyPathTestRuns = await this.checkpointUnhappyPathTestCollection.find(
        this.buildCheckpointUnhappyPathTestFilter(checkpoint.tenantId, { checkpointId: checkpoint._id })
      ).toArray();

      // Check if checkpoint has testsets
      if (happyPathTestRuns.length === 0 && unhappyPathTestRuns.length === 0) {
        throw new Error('Checkpoint must have testsets to run tests');
      }

      // Run the tests
      this.logger.log(`Running checkpoint testset with ${happyPathTestRuns.length} happy path and ${unhappyPathTestRuns.length} unhappy path tests`);

      // Collect all test IDs that need data fetching
      const happyPathTestIds = happyPathTestRuns.map(test => test.datasetTestId);
      const unhappyPathTestIds = unhappyPathTestRuns.map(test => test.datasetTestId);

      // Fetch expected data in bulk
      const happyPathTestData = await this.datasetHappyPathTestCollection.find(
        this.buildDatasetHappyPathTestFilter(undefined, { _id: { $in: happyPathTestIds } })
      ).toArray();

      const unhappyPathTestData = await this.datasetUnhappyPathTestCollection.find(
        this.buildDatasetUnhappyPathTestFilter(undefined, { _id: { $in: unhappyPathTestIds } })
      ).toArray();

      // Create lookup maps for quick access
      const happyPathDataMap = new Map(happyPathTestData.map(test => [test._id!.toString(), test]));
      const unhappyPathDataMap = new Map(unhappyPathTestData.map(test => [test._id!.toString(), test]));

      // Run happy path tests
      for (const test of happyPathTestRuns) {
        const expectedData = happyPathDataMap.get(test.datasetTestId.toString());
        if (!expectedData) {
          this.logger.warn(`Expected data not found for happy path test ${test._id}`);
          continue;
        }
        const result = await this.dynamicRunnerService.runHappyPathTest(test, checkpoint.functionCode, checkpoint.functionSchema, expectedData.data.expectedTotal);
        // Update test run result in database
        await this.checkpointHappyPathTestCollection.updateOne(
          { _id: test._id },
          { $set: { testRunResult: result } }
        );

        if (!result.passed && failFast) {
          this.logger.log('Fail fast enabled, stopping execution on first failure');
          break;
        }
      }

      // Run unhappy path tests
      for (const test of unhappyPathTestRuns) {
        const expectedData = unhappyPathDataMap.get(test.datasetTestId.toString());
        if (!expectedData) {
          this.logger.warn(`Expected data not found for unhappy path test ${test._id}`);
          continue;
        }
        const result = await this.dynamicRunnerService.runUnhappyPathTest(test, checkpoint.functionCode, checkpoint.functionSchema, expectedData.data.expectedErrorType);
        // Update test run result in database
        await this.checkpointUnhappyPathTestCollection.updateOne(
          { _id: test._id },
          { $set: { testRunResult: result } }
        );
        if (!result.passed && failFast) {
          this.logger.log('Fail fast enabled, stopping execution on first failure');
          break;
        }
      }

      this.logger.log(`Successfully ran tests for checkpoint ${checkpoint._id}`);
    } catch (error) {
      this.logger.error(`Failed to run checkpoint testset for checkpoint ${checkpoint._id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async assignTestingDataset(agentId: string, datasetId: string, tenantId: string | undefined): Promise<void> {
    await this.testingDatasetAssignmentCollection.insertOne({
      pricingAgentId: new ObjectId(agentId),
      testingDatasetId: new ObjectId(datasetId),
      tenantId: tenantId,
      assignedAt: new Date(),
    });
  }

  async findTestingDatasetAssignments(agentId: string, datasetId: string, tenantId?: string): Promise<TestingDatasetAssignment[]> {
    const filter = this.buildTestingDatasetAssignmentFilter(tenantId, {
      pricingAgentId: new ObjectId(agentId),
      testingDatasetId: new ObjectId(datasetId),
    });

    return this.testingDatasetAssignmentCollection.find(filter).toArray();
  }

  async getCheckpointTestset(checkpoint: PricingAgentCheckpoint): Promise<CheckpointTestsetDto> {
    this.logger.log(`Getting checkpoint testset for checkpoint: ${checkpoint._id}`);

    try {
      // Get test runs from separate collections
      const happyPathTestRuns = await this.checkpointHappyPathTestCollection.find(
        this.buildCheckpointHappyPathTestFilter(checkpoint.tenantId, { checkpointId: checkpoint._id })
      ).toArray();

      const unhappyPathTestRuns = await this.checkpointUnhappyPathTestCollection.find(
        this.buildCheckpointUnhappyPathTestFilter(checkpoint.tenantId, { checkpointId: checkpoint._id })
      ).toArray();

      // Check if checkpoint has testsets
      if (happyPathTestRuns.length === 0 && unhappyPathTestRuns.length === 0) {
        this.logger.log(`No testsets found for checkpoint: ${checkpoint._id}`);
        return {
          checkpointId: checkpoint._id!,
          happyPathTests: [],
          unhappyPathTests: []
        };
      }

      // Collect all test IDs that need data fetching
      const happyPathTestIds = happyPathTestRuns.map(test => test.datasetTestId);
      const unhappyPathTestIds = unhappyPathTestRuns.map(test => test.datasetTestId);

      // Fetch expected data in bulk
      const happyPathTestData = await this.datasetHappyPathTestCollection.find({
        _id: { $in: happyPathTestIds },
        deletedAt: null
      }).toArray();

      const unhappyPathTestData = await this.datasetUnhappyPathTestCollection.find({
        _id: { $in: unhappyPathTestIds },
        deletedAt: null
      }).toArray();

      // Create lookup maps for quick access
      const happyPathDataMap = new Map(happyPathTestData.map(test => [test._id!.toString(), test]));
      const unhappyPathDataMap = new Map(unhappyPathTestData.map(test => [test._id!.toString(), test]));

      // Build the response with test data
      const happyPathTestsWithData: CheckpointHappyPathTestWithData[] = [];
      const unhappyPathTestsWithData: CheckpointUnhappyPathTestWithData[] = [];

      // Map happy path tests with their data
      for (const test of happyPathTestRuns) {
        const testData = happyPathDataMap.get(test.datasetTestId.toString());
        if (testData) {
          happyPathTestsWithData.push({
            _id: test._id,
            checkpointId: test.checkpointId,
            datasetId: test.datasetId,
            datasetTestId: test.datasetTestId,
            createdAt: test.createdAt,
            functionInputParams: test.functionInputParams,
            testRunResult: test.testRunResult,
            testData: testData.data
          });
        }
      }

      // Map unhappy path tests with their data
      for (const test of unhappyPathTestRuns) {
        const testData = unhappyPathDataMap.get(test.datasetTestId.toString());
        if (testData) {
          unhappyPathTestsWithData.push({
            _id: test._id,
            checkpointId: test.checkpointId,
            datasetId: test.datasetId,
            datasetTestId: test.datasetTestId,
            createdAt: test.createdAt,
            functionInputParams: test.functionInputParams,
            testRunResult: test.testRunResult,
            testData: testData.data
          });
        }
      }

      const result: CheckpointTestsetDto = {
        checkpointId: checkpoint._id!,
        happyPathTests: happyPathTestsWithData,
        unhappyPathTests: unhappyPathTestsWithData
      };

      this.logger.log(`Successfully retrieved testset for checkpoint ${checkpoint._id} with ${happyPathTestsWithData.length} happy path and ${unhappyPathTestsWithData.length} unhappy path tests`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get checkpoint testset for checkpoint ${checkpoint._id}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
