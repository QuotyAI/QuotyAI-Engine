import { Injectable, Logger } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { LLMService, LangchainInitModelConfig } from './llm.service';
import { initChatModel } from 'langchain/chat_models/universal';

export interface OrderConversionRequest {
  conversationHistory: Array<{
    message: string;
    role: 'AI' | 'User';
  }>;
  newUserMessage: string;
  schema: string;
}

export interface OrderConversionResponse {
  structuredOrderInput: any;
}

const OrderConversionSchema = z.object({
  structuredOrderInput: z.any().describe('The structured order input object that matches the provided OrderInput schema')
}).describe('Schema for converting natural language order into structured JSON object');

@Injectable()
export class AiOrderConversionAgentService {
  private readonly logger = new Logger(AiOrderConversionAgentService.name);

  constructor() {
    this.logger.log('AiOrderConversionAgentService initialized');
  }

  async convertOrder(request: OrderConversionRequest, llmConfig: LangchainInitModelConfig): Promise<OrderConversionResponse> {
    this.logger.log(`Converting conversation to structured format`);

    try {
      // Generate the prompt using the embedded template
      const systemPrompt = this.generateSystemPrompt(request.schema);
      const userMessage = this.generateUserMessage(request.conversationHistory, request.newUserMessage);

      this.logger.debug(`Prompt generated: ${systemPrompt.length + userMessage.length} characters`);

      // Get the LLM instance
      const llm = await initChatModel(llmConfig.model, {
        ...llmConfig.additionalConfig,
      });

      // Generate the structured order as JSON
      const result = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userMessage)
      ]);

      const llmResult = this.convertLlmOutputToSchema(result.content as string);
      this.logger.log(`Successfully converted order`);

      return {
        structuredOrderInput: llmResult.structuredOrderInput,
      };
    } catch (error) {
      this.logger.error(`Failed to convert order: ${error.message}`, error.stack);
      throw error;
    }
  }

  private generateSystemPrompt(schema: string): string {
    return `<role>You are an expert data analyst specializing in converting natural language orders into structured JSON objects.
Your task is to parse human-readable order descriptions and convert them into properly formatted data structures that match the provided schema.</role>

  <task>Convert the natural language order description into a structured JSON object that matches the provided OrderInput schema.
  The output must include the structuredOrderInput that matches the schema exactly.

Key Requirements:
- The structured data must accurately represent all services, options, and constraints explicitly mentioned in the natural language input
- Do not add any services, options, or constraints not present in the input description
- Focus on input structure only; ensure the JSON matches the provided schema exactly
- Ensure the output is valid JSON that can be parsed without errors

The output must include:
- structuredOrderInput as a valid OrderInput object matching the schema exactly
- Proper JSON structure for all input components matching the OrderInput schema</task>

  <order-schema>
  ${schema}
  </order-schema>

  <example>
  Input Conversation History:
  [
    {
      "message": "I need cleaning services for my apartment",
      "role": "User"
    },
    {
      "message": "I'd be happy to help you with cleaning services for your apartment. What type of cleaning are you interested in - general cleaning, deep cleaning, or upholstery cleaning?",
      "role": "AI"
    },
    {
      "message": "General cleaning and also my sofa needs cleaning",
      "role": "User"
    },
    {
      "message": "Great! So you need general cleaning for your apartment and upholstery cleaning for your sofa. For the general cleaning, would you like a one-time service or recurring? And for the sofa, could you tell me what type it is (2-seats, 3-seats, etc.)?",
      "role": "AI"
    },
    {
      "message": "One-time general cleaning and it's a 2-seat sofa",
      "role": "User"
    },
    {
      "message": "Perfect! I've noted your requirements: one-time general cleaning service for your apartment and upholstery cleaning for a 2-seat sofa. Is there anything else you'd like to add or any specific areas that need extra attention?",
      "role": "AI"
    }
  ]

  New User Message: "That covers everything. Please proceed with getting me a quote."

  Example Output:
  {
    "structuredOrderInput": {
      "services": [
        {
          "type": "GeneralCleaning",
          "option": "3h-single",
          "numberOfVisits": 1
        },
        {
          "type": "Upholstery",
          "item": "2-seats",
          "quantity": 1
        }
      ]
    }
  }
  </example>

  <constraints>
  - **CRITICAL: You MUST generate a structured output for the input provided**
  - Output must be valid JSON with a single key "structuredOrderInput"
  - structuredOrderInput must be a valid OrderInput object matching the schema exactly
  - Use correct enum values and data types
  - Include all required fields for each service type
  - Handle quantities and visit numbers correctly
  - Respect service combination rules
  - Parse natural language accurately to extract all service details
  - Handle multiple services in a single order
  - Use the exact property names from the schema
  - Ensure JSON is properly formatted and can be parsed by standard JSON parsers
  </constraints>

  <output-format>
  Generate only a valid JSON object matching the schema. No additional text, explanations, or markdown formatting.
  The JSON must be syntactically correct and directly usable in a JavaScript/TypeScript environment.
  </output-format>`;
  }

  private generateUserMessage(conversationHistory: Array<{message: string; role: 'AI' | 'User'}>, newUserMessage: string): string {
    return `Convert the following conversation into a structured JSON object according to the provided OrderInput schema.

  <conversation-history>
  ${JSON.stringify(conversationHistory, null, 2)}
  </conversation-history>

  <new-user-message>
  ${newUserMessage}
  </new-user-message>`;
  }

  private convertLlmOutputToSchema(rawOutput: string): z.infer<typeof OrderConversionSchema> {
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
      if (!parsedOutput.structuredOrderInput) {
        throw new Error('LLM response does not contain expected "structuredOrder" field');
      }

      this.logger.log(`Successfully converted LLM output to schema format`);
      return parsedOutput as z.infer<typeof OrderConversionSchema>;

    } catch (error) {
      this.logger.error(`Failed to convert LLM output to schema: ${error.message}`, error.stack);
      throw new Error(`Failed to convert LLM output to expected schema: ${error.message}`);
    }
  }
}
