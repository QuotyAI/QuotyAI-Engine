import { Injectable, Logger } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { HappyPathTestData, UnhappyPathTestData, CheckpointHappyPathTestRun, CheckpointUnhappyPathTestRun, PricingAgentCheckpoint, DatasetHappyPathTestData, DatasetUnhappyPathTestData } from '../models/mongodb.model';
import { LLMService, LLMServiceConfig } from './llm.service';

export interface TypedOrderInputGenerationRequest {
  happyPathTests: DatasetHappyPathTestData[];
  unhappyPathTests: DatasetUnhappyPathTestData[];
  checkpoint: PricingAgentCheckpoint;
}

export interface GeneratedTypedOrderInputs {
  happyPathTestRuns: CheckpointHappyPathTestRun[]; // Generated happy path test runs
  unhappyPathTestRuns: CheckpointUnhappyPathTestRun[]; // Generated unhappy path test runs
}

const TypedOrderInputSchema = z.object({
  orders: z.array(z.object({
    index: z.number().describe('The index position of the corresponding natural language input (0-based)'),
    structuredOrderInput: z.any().describe('The structured order input object that matches the provided OrderInput schema')
  })).describe('Array of structured order inputs, one for each natural language input provided')
}).describe('Schema for generating structured order inputs from natural language descriptions. Each input must have a corresponding structured output.');

@Injectable()
export class AiTestsetGenerationAgentService {
  private readonly logger = new Logger(AiTestsetGenerationAgentService.name);

  constructor(private readonly llmService: LLMService) {
    this.logger.log('AiTestsetGenerationAgentService initialized');
  }

  async generateTypedOrderInputs(request: TypedOrderInputGenerationRequest, llmConfig?: LLMServiceConfig): Promise<GeneratedTypedOrderInputs> {
    this.logger.log(`Generating typed order inputs from test data`);

    try {
      // Get the LLM instance
      const llm = await this.llmService.getLLM(llmConfig);

      // Generate the prompt using the embedded template
      if (!request.checkpoint.functionSchema) {
        throw new Error('Function schema is required to generate typed order inputs');
      }
      const promptHappyPathTests = this.generatePrompt(request.happyPathTests.map(test => test.data.orderInputNaturalLanguage), request.checkpoint.functionSchema);
      const rawLlmResultHappyPathTests = await llm.invoke([
        new SystemMessage(promptHappyPathTests.systemPrompt),
        new HumanMessage(promptHappyPathTests.userMessage)
      ]);
      const llmResultHappyPathTests = this.convertLlmOutputToSchema(rawLlmResultHappyPathTests.content as string, request.happyPathTests.length);
      this.logger.log(`Successfully generated HappyPathTests`);
      const happyPathTestRuns: CheckpointHappyPathTestRun[] = [];
      for (const order of llmResultHappyPathTests.orders) {
        const correspondingTest = request.happyPathTests[order.index];
        happyPathTestRuns.push({
          datasetId: correspondingTest.testingDatasetId,
          datasetTestId: correspondingTest._id!,
          functionInputParams: order.structuredOrderInput,
          checkpointId: request.checkpoint._id!,
          tenantId: request.checkpoint.tenantId,
          createdAt: new Date(),
        });
      }

      const promptUnhappyPathTests = this.generatePrompt(request.unhappyPathTests.map(test => test.data.orderInputNaturalLanguage), request.checkpoint.functionSchema);
      const rawLlmResultUnhappyPathTests = await llm.invoke([
        new SystemMessage(promptUnhappyPathTests.systemPrompt),
        new HumanMessage(promptUnhappyPathTests.userMessage)
      ]);
      const llmResultUnhappyPathTests = this.convertLlmOutputToSchema(rawLlmResultUnhappyPathTests.content as string, request.unhappyPathTests.length);
      this.logger.log(`Successfully generated UnhappyPathTests`);
      const unhappyPathTestRuns: CheckpointUnhappyPathTestRun[] = [];
      for (const order of llmResultUnhappyPathTests.orders) {
        const correspondingTest = request.unhappyPathTests[order.index];
        unhappyPathTestRuns.push({
          datasetId: correspondingTest.testingDatasetId,
          datasetTestId: correspondingTest._id!,
          functionInputParams: order.structuredOrderInput,
          checkpointId: request.checkpoint._id!,
          tenantId: request.checkpoint.tenantId,
          createdAt: new Date(),
        });
      }

      this.logger.log(`Generated total ${happyPathTestRuns.length} happy path and ${unhappyPathTestRuns.length} unhappy path typed order inputs`);
      return { happyPathTestRuns, unhappyPathTestRuns };
    } catch (error) {
      this.logger.error(`Failed to generate typed order inputs: ${error.message}`, error.stack);
      throw error;
    }
  }

  private generatePrompt(naturalLanguageInputs: string[], inputOrderSchema: string): { systemPrompt: string; userMessage: string } {
    // Format natural language inputs with indices
    const formattedInputs = naturalLanguageInputs.map((input, index) => ({
      index,
      inputNaturalLanguage: input
    }));

    const systemPrompt = `<role>You are an expert data analyst specializing in converting natural language orders into structured JSON objects.
Your task is to parse human-readable order descriptions and convert them into properly formatted data structures that match the provided schema.</role>

  <task>Convert each natural language order description into a structured JSON object that matches the provided OrderInput schema.
  Each output item must include the index of the corresponding input and the schema-compatible structured data.

Key Requirements:
- The structured data must accurately represent all services, options, and constraints explicitly mentioned in the natural language input
- Do not add any services, options, or constraints not present in the input description
- Focus on input structure only; ensure the JSON matches the provided schema exactly
- Ensure the output is valid JSON that can be parsed without errors

The output must include:
- orders as an array of objects, each with index and structuredOrderInput
- Proper JSON structure for all input components matching the OrderInput schema</task>

  <example>
  Example Input Natural Language Orders:
  [{
    "index": 0,
    "inputNaturalLanguage": "I want to book a 3-hour general cleaning service for next week, and also get my 2-seat sofa cleaned. I need this done twice."
  },
  {
    "index": 1,
    "inputNaturalLanguage": "Deep cleaning for my 90 square meter apartment with curtains and L-sofa add-ons"
  }]

  Example Schema:
  export enum GeneralCleaningOption {
      ThreeHoursSingle = '3h-single',
      FourHoursSingle = '4h-single',
      ThreeHoursWeekly = '3h-weekly',
  }

  export enum DeepCleaningAddonItem {
      Curtains = 'curtains',
      LSofa = 'l-sofa',
  }

  export enum UpholsteryItem {
      TwoSeatsSofa = '2-seats',
      ThreeSeatsSofa = '3-seats',
  }

  export interface BaseServiceInput {
      type: 'GeneralCleaning' | 'DeepCleaning' | 'Upholstery';
      serviceId?: string;
  }

  export interface GeneralCleaningInput extends BaseServiceInput {
      type: 'GeneralCleaning';
      option: GeneralCleaningOption;
      numberOfVisits: number;
  }

  export interface DeepCleaningInput extends BaseServiceInput {
      type: 'DeepCleaning';
      areaSqm: number;
      addons: DeepCleaningAddonItem[];
  }

  export interface UpholsteryInput extends BaseServiceInput {
      type: 'Upholstery';
      item: UpholsteryItem;
      quantity: number;
  }
  export type ServiceInput = GeneralCleaningInput | DeepCleaningInput | UpholsteryInput;
  export interface OrderInput {
      services: ServiceInput[];
  }

  ---

  Example Output:
  {
    "orders": [
    {
      "index": 0,
      "structuredOrderInput": {
        "services": [
          {
            "type": "GeneralCleaning",
            "option": "3h-single",
            "numberOfVisits": 2
          },
          {
            "type": "Upholstery",
            "item": "2-seats",
            "quantity": 1
          }
        ]
      }
    },
    {
      "index": 1,
      "structuredOrderInput": {
        "services": [
          {
            "type": "DeepCleaning",
            "areaSqm": 90,
            "addons": ["curtains", "l-sofa"]
          }
        ]
      }
    }
  ]}
  </example>

  <constraints>
  - **CRITICAL: You MUST generate a structured output for EVERY input item provided - NO EXCEPTIONS**
  - Output must be valid JSON with a single key "orders" containing an array
  - Each array element must have index and structuredOrderInput fields
  - Index must match the position of the corresponding natural language input (0-based)
  - structuredOrderInput must be a valid OrderInput object matching the schema exactly
  - Use correct enum values and data types
  - Include all required fields for each service type
  - Handle quantities and visit numbers correctly
  - Respect service combination rules
  - Parse natural language accurately to extract all service details
  - Handle multiple services in a single order
  - Use the exact property names from the schema
  - **MANDATORY: Generate one structured input for each natural language input provided**
  - **MANDATORY: The output array must have the same length as the input array**
  - Maintain the same order as the input array
  - Ensure JSON is properly formatted and can be parsed by standard JSON parsers
  </constraints>

  <output-format>
  Generate only a valid JSON object matching the schema. No additional text, explanations, or markdown formatting.
  The JSON must be syntactically correct and directly usable in a JavaScript/TypeScript environment.
  </output-format>`;

    const userMessage = `Transform the following natural language order descriptions into structured JSON objects according to the provided OrderInput schema.
    
  <natural-language-inputs>
  ${JSON.stringify(formattedInputs, null, 2)}
  </natural-language-inputs>

  <order-schema>
  ${inputOrderSchema}
  </order-schema>`;

    return { systemPrompt, userMessage };
  }

  private convertLlmOutputToSchema(rawOutput: string, expectedLength: number): z.infer<typeof TypedOrderInputSchema> {
    try {
      this.logger.log(`Converting raw LLM output to schema format`);

      // Try to extract JSON from the raw output
      let jsonContent = rawOutput.trim();

      // Remove markdown code blocks if present
      jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      jsonContent = jsonContent.replace(/```\s*/g, '');

      // Try to parse the JSON
      let parsedOutput;
      try {
        parsedOutput = JSON.parse(jsonContent);
      } catch (parseError) {
        this.logger.error(`Failed to parse JSON from LLM output: ${parseError.message}`);
        throw new Error(`Invalid JSON in LLM response: ${parseError.message}`);
      }

      // Validate that it has the expected structure
      if (!parsedOutput.orders || !Array.isArray(parsedOutput.orders)) {
        throw new Error('LLM response does not contain expected "orders" array');
      }

      // Ensure we have the expected number of items
      if (parsedOutput.orders.length !== expectedLength) {
        this.logger.warn(`LLM returned ${parsedOutput.orders.length} items but expected ${expectedLength}`);
      }

      // Validate each order item has the required fields
      for (let i = 0; i < parsedOutput.orders.length; i++) {
        const order = parsedOutput.orders[i];
        if (typeof order.index !== 'number' || !order.structuredOrderInput) {
          this.logger.warn(`Order item ${i} missing required fields (index or structuredOrderInput)`);
        }
      }

      this.logger.log(`Successfully converted LLM output to schema format`);
      return parsedOutput as z.infer<typeof TypedOrderInputSchema>;

    } catch (error) {
      this.logger.error(`Failed to convert LLM output to schema: ${error.message}`, error.stack);
      throw new Error(`Failed to convert LLM output to expected schema: ${error.message}`);
    }
  }
}
