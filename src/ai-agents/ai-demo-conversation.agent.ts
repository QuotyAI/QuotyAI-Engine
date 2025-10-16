import { Injectable, Logger } from '@nestjs/common';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { z } from 'zod';
import { HumanInputMessage, TagEnum } from '../models/mongodb.model';

export interface DemoConversationGenerationRequest {
  pricingAgentContext: string;
  functionSchema: string;
  functionCode: string;
}

export interface DemoConversationGenerationResponse {
  conversationHistory: Array<{
    message: string;
    role: 'AI' | 'User';
  }>;
  nextUserMessage: string;
}

const DemoConversationSchema = z.object({
  conversationHistory: z.array(z.object({
    message: z.string().describe('The message text'),
    role: z.enum(['AI', 'User']).describe('The role of the message sender')
  })).describe('Array of messages forming the conversation history, ending with an AI message'),
  nextUserMessage: z.string().describe('The next user message confirming the order')
}).describe('Schema for generating demo conversations with conversation history and next user message');

@Injectable()
export class AiDemoConversationAgentService {
  private llm: ChatVertexAI;
  private readonly logger = new Logger(AiDemoConversationAgentService.name);

  constructor() {
    this.llm = new ChatVertexAI({ model: 'gemini-2.5-flash' });
    this.logger.log('AiDemoConversationAgentService initialized with Gemini 2.5 Flash model');
  }

  async generateDemoConversation(request: DemoConversationGenerationRequest): Promise<DemoConversationGenerationResponse> {
    this.logger.log(`Generating demo conversation for pricing agent`);

    try {
      // Generate the prompt using the embedded template
      const prompt = this.generatePrompt(request.pricingAgentContext, request.functionSchema, request.functionCode);

      this.logger.debug(`Prompt generated: ${prompt.systemPrompt.length} characters`);

      // Generate the demo conversation
      const result = await this.llm.invoke([
        { role: 'system', content: prompt.systemPrompt },
        { role: 'user', content: prompt.userMessage }
      ]);

      const llmResult = this.convertLlmOutputToSchema(result.content as string);
      this.logger.log(`Successfully generated demo conversation with ${llmResult.conversationHistory.length} messages in history`);

      return {
        conversationHistory: llmResult.conversationHistory,
        nextUserMessage: llmResult.nextUserMessage,
      };
    } catch (error) {
      this.logger.error(`Failed to generate demo conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  private generatePrompt(pricingAgentContext: string, functionSchema: string, functionCode: string): { systemPrompt: string; userMessage: string } {
    const systemPrompt = `<role>You are an expert conversation designer specializing in creating realistic demo conversations for pricing agent playgrounds. Your task is to generate natural, progressive conversations that showcase the pricing agent's capabilities.</role>

  <task>Generate a realistic demo conversation that demonstrates how users would interact with a pricing agent to build and clarify their order details, ending with a conversation history and a next user message for order confirmation. The conversation should focus on gathering and clarifying order requirements WITHOUT discussing pricing. The output should include:
  - conversationHistory: Array of messages alternating between User and AI, ending with an AI message that confirms order understanding
  - nextUserMessage: A user message confirming the order (like "Yes, that looks good" or "Please proceed with the booking")</task>

  <context>
  Demo conversations are used to showcase pricing agents in playground environments. They should demonstrate:
  - How users describe their service needs in natural language
  - Progressive refinement and clarification of order requirements
  - AI asking clarifying questions about service details, quantities, options, etc.
  - Realistic conversation flow for building a complete order specification
  - The conversation should end with the order fully specified and understood, ready for pricing calculation
  </context>

  <example>
  Pricing Context: "Cleaning service business offering general cleaning, deep cleaning, and upholstery services with various pricing tiers and add-ons."

  Function Schema: "OrderInput interface with services array containing GeneralCleaning, DeepCleaning, and Upholstery service types"

  Output:
  {
    "conversationHistory": [
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
    ],
    "nextUserMessage": "That covers everything. Please proceed with getting me a quote."
  }
  </example>

  <constraints>
  - Generate 4-8 messages for a complete conversation that builds a clear order specification
  - Start with basic requests and progressively clarify all order details
  - Focus on gathering complete order information WITHOUT any pricing discussion
  - AI should ask clarifying questions about service types, quantities, options, and specifications
  - Ensure conversation flows naturally with alternating User and AI messages
  - Cover different service types and gather all necessary details for pricing calculation
  - Make messages conversational and realistic
  - Each message should be a complete, standalone input or response
  - Alternate between "User" and "AI" roles appropriately
  - AI messages should focus on understanding and confirming order details
  - User messages should provide order specifications and answer clarifying questions
  - End with AI confirming complete understanding of the order
  - The conversation should result in a fully specified order ready for pricing
  </constraints>

  <output-format>
  Generate only a valid JSON object with "conversationHistory" and "nextUserMessage" fields. No additional text, explanations, or markdown formatting.
  </output-format>`;

    const userMessage = `<pricing-agent-context>
  ${pricingAgentContext}
  </pricing-agent-context>

  <function-schema>
  ${functionSchema}
  </function-schema>

  <function-code>
  ${functionCode}
  </function-code>`;

    return { systemPrompt, userMessage };
  }

  private convertLlmOutputToSchema(rawOutput: string): z.infer<typeof DemoConversationSchema> {
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
      if (!parsedOutput.conversationHistory || !Array.isArray(parsedOutput.conversationHistory)) {
        throw new Error('LLM response does not contain expected "conversationHistory" array');
      }

      if (!parsedOutput.nextUserMessage || typeof parsedOutput.nextUserMessage !== 'string') {
        throw new Error('LLM response does not contain expected "nextUserMessage" string');
      }

      // Validate each message has required fields
      for (let i = 0; i < parsedOutput.conversationHistory.length; i++) {
        const msg = parsedOutput.conversationHistory[i];
        if (!msg.message || !msg.role) {
          this.logger.warn(`Message ${i} missing required fields (message or role)`);
        }
      }

      this.logger.log(`Successfully converted LLM output to schema format`);
      return parsedOutput as z.infer<typeof DemoConversationSchema>;

    } catch (error) {
      this.logger.error(`Failed to convert LLM output to schema: ${error.message}`, error.stack);
      throw new Error(`Failed to convert LLM output to expected schema: ${error.message}`);
    }
  }
}
