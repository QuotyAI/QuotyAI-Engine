import { Injectable, Logger } from '@nestjs/common';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { z } from 'zod';
import { QuoteResult } from '../models/mongodb.model';

export interface PlaygroundMessageGenerationRequest {
  conversation: Array<{
    message: string;
    role: 'AI' | 'User';
  }>;
  functionResult: QuoteResult;
  pricingAgentContext: string;
}

export interface PlaygroundMessageGenerationResponse {
  aiMessage: string;
}

const PlaygroundMessageSchema = z.object({
  aiMessage: z.string().describe('The AI response message to be displayed in the playground conversation')
}).describe('Schema for generating AI response messages in playground conversations');

@Injectable()
export class AiPlaygroundMessageAgentService {
  private llm: ChatVertexAI;
  private readonly logger = new Logger(AiPlaygroundMessageAgentService.name);

  constructor() {
    this.llm = new ChatVertexAI({ model: 'gemini-2.5-flash' });
    this.logger.log('AiPlaygroundMessageAgentService initialized with Gemini 2.5 Flash model');
  }

  async generatePlaygroundMessage(request: PlaygroundMessageGenerationRequest): Promise<PlaygroundMessageGenerationResponse> {
    this.logger.log(`Generating AI playground message`);

    try {
      // Generate the prompt using the embedded template
      const prompt = this.generatePrompt(request.conversation, request.functionResult, request.pricingAgentContext);

      this.logger.debug(`Prompt generated: ${prompt.systemPrompt.length} characters`);

      // Generate the AI message
      const result = await this.llm.invoke([
        { role: 'system', content: prompt.systemPrompt },
        { role: 'user', content: prompt.userMessage }
      ]);

      const llmResult = this.convertLlmOutputToSchema(result.content as string);
      this.logger.log(`Successfully generated playground message`);

      return {
        aiMessage: llmResult.aiMessage,
      };
    } catch (error) {
      this.logger.error(`Failed to generate playground message: ${error.message}`, error.stack);
      throw error;
    }
  }

  private generatePrompt(conversation: Array<{message: string; role: 'AI' | 'User'}>, functionResult: QuoteResult, pricingAgentContext: string): { systemPrompt: string; userMessage: string } {
    // Format conversation history
    const conversationHistory = conversation.map(msg => ({
      message: msg.message,
      role: msg.role
    }));

    const systemPrompt = `<role>You are an AI assistant for a pricing agent playground. Your role is to generate helpful, conversational responses based on the pricing function execution results and the ongoing conversation context.</role>

  <task>Generate a natural, helpful AI response message for the playground conversation. The response should:
  - Be conversational and user-friendly
  - Reference the pricing calculation results appropriately
  - Provide context about what the pricing agent calculated
  - Answer any questions from the conversation history
  - Be concise but informative
  - Use appropriate business language for pricing/quotation scenarios</task>

  <context>
  The playground allows users to interact with pricing agents that calculate quotes based on structured order inputs. The AI receives:
  - Conversation history with messages and roles (AI/User)
  - Function execution results (pricing calculations)
  - Pricing agent context (business rules, pricing logic, etc.)
  </context>

  <example>
  Conversation History:
  [
    {
      "message": "I need a quote for 3-hour general cleaning",
      "role": "User"
    },
    {
      "message": "I'd be happy to help with that. What type of cleaning service are you interested in?",
      "role": "AI"
    },
    {
      "message": "Also add upholstery cleaning for a 2-seat sofa",
      "role": "User"
    }
  ]

  Function Result:
  {
    "total": 450,
    "errors": []
  }

  AI Response: "Based on your request for 3-hour general cleaning and upholstery cleaning for a 2-seat sofa, the total quote comes to $450. This includes $150 for the general cleaning service and $300 for the sofa cleaning."
  </example>

  <constraints>
  - Keep responses conversational and natural
  - Always reference the calculated total when available
  - Explain pricing breakdown when relevant
  - Address any specific questions from the conversation
  - Handle error cases gracefully (if functionResult contains errors)
  - Stay in character as a pricing assistant
  - Be concise but comprehensive
  - Use professional but friendly tone
  - Reference conversation context appropriately
  </constraints>

  <output-format>
  Generate only a valid JSON object with an "aiMessage" field containing the response text. No additional text, explanations, or markdown formatting.
  </output-format>`;

    // Create a simplified function result for the prompt (only total and errors)
    const simplifiedFunctionResult = {
      total: functionResult.total,
      errors: functionResult.errors || []
    };

    const userMessage = `<conversation-history>
  ${JSON.stringify(conversationHistory, null, 2)}
  </conversation-history>

  <function-result>
  ${JSON.stringify(simplifiedFunctionResult, null, 2)}
  </function-result>

  <pricing-agent-context>
  ${pricingAgentContext}
  </pricing-agent-context>`;

    return { systemPrompt, userMessage };
  }

  private convertLlmOutputToSchema(rawOutput: string): z.infer<typeof PlaygroundMessageSchema> {
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
      if (!parsedOutput.aiMessage) {
        throw new Error('LLM response does not contain expected "aiMessage" field');
      }

      this.logger.log(`Successfully converted LLM output to schema format`);
      return parsedOutput as z.infer<typeof PlaygroundMessageSchema>;

    } catch (error) {
      this.logger.error(`Failed to convert LLM output to schema: ${error.message}`, error.stack);
      throw new Error(`Failed to convert LLM output to expected schema: ${error.message}`);
    }
  }
}
