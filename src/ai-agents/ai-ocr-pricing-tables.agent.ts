import { Injectable, Logger } from '@nestjs/common';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { ExtractedPricingTable, PricingTableExtractionRequest } from 'src/dtos/text-extraction.dto';
import { LangchainCongigService, LangchainInitModelConfig } from './langchain-config.service';
import { initChatModel } from 'langchain/chat_models/universal';


@Injectable()
export class AiOcrPricingTablesAgentService {
  private readonly logger = new Logger(AiOcrPricingTablesAgentService.name);

  constructor(private readonly llmService: LangchainCongigService) {
    this.logger.log('AiPricingTableExtractionAgentService initialized');
  }

  async extractPricingTable(request: PricingTableExtractionRequest, llmConfig: LangchainInitModelConfig): Promise<ExtractedPricingTable> {
    this.logger.log(`Extracting pricing table from image (${request.imageMimeType})`);

    try {
      // Generate the prompt using the embedded template
      const prompt = this.generatePrompt(request.additionalContext);

      this.logger.debug(`Prompt generated: ${prompt.length} characters`);

      
      // Create image message for the LLM
      const imageMessage = {
        type: 'image_url' as const,
        image_url: {
          url: `data:${request.imageMimeType};base64,${request.imageData}`,
        },
      };

      const llm = await initChatModel(llmConfig.model, {
        ...llmConfig.additionalConfig,
      });

      // Extract pricing table using vision capabilities
      const result = await llm.invoke([
        new SystemMessage(prompt),
        new HumanMessage({
          content: [
            { type: 'text', text: 'Please extract the pricing table from this image into markdown format, including any additional rules and conditions mentioned.' },
            imageMessage,
          ],
        })
      ]);

      const response = (result.content as string).trim();

      // Parse the response to extract markdown and confidence
      const { markdown, rawText, confidence } = this.parseResponse(response);

      this.logger.log(`Successfully extracted pricing table (${markdown.length} characters, confidence: ${confidence})`);

      return {
        markdown,
        rawText,
        confidence,
      };
    } catch (error) {
      this.logger.error(`Failed to extract pricing table: ${error.message}`, error.stack);
      throw error;
    }
  }

  private parseResponse(response: string): { markdown: string; rawText: string; confidence: number } {
    // Try to extract structured response if the LLM follows the format
    const markdownMatch = response.match(/```markdown\s*([\s\S]*?)\s*```/);
    const confidenceMatch = response.match(/confidence:\s*([0-9.]+)/i);

    const markdown = markdownMatch ? markdownMatch[1].trim() : response;
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.8; // Default confidence

    return {
      markdown,
      rawText: response,
      confidence: Math.min(Math.max(confidence, 0), 1), // Clamp between 0 and 1
    };
  }

  private generatePrompt(additionalContext?: string): string {
    return `<role>You are an expert data extraction specialist specializing in converting pricing tables from images into structured markdown format. You excel at identifying pricing structures, rules, conditions, and business logic from visual representations.</role>

<task>Analyze the provided image containing a pricing table and extract all pricing information, rules, and conditions into a comprehensive markdown table format.

Key Requirements:
- Extract all pricing tiers, rates, and conditions visible in the image
- Identify any minimum/maximum values, thresholds, or breakpoints
- Capture additional rules, conditions, and business logic mentioned
- Maintain the logical structure and relationships between different pricing elements
- Include any footnotes, disclaimers, or additional terms mentioned
- Preserve the original pricing logic and calculations where visible

Output Format:
1. A markdown table with clear headers and pricing data
2. Additional sections for rules and conditions if present
3. A confidence score (0.0-1.0) indicating extraction accuracy

The output should be immediately usable for pricing calculations and business rule implementation.</task>

<extraction-guidelines>
- Use descriptive column headers that match the pricing structure
- Include units (currency, time periods, quantities) where specified
- Preserve hierarchical relationships between pricing elements
- Extract conditional pricing (e.g., "if X then Y", "minimum Z required")
- Identify any exclusions, limitations, or special cases
- Maintain numerical precision as shown in the image
- Use consistent formatting for similar pricing elements
</extraction-guidelines>

<markdown-format-example>
### Pricing Table

| Service Type | Duration/Quantity | Base Price | Conditions |
|-------------|------------------|------------|------------|
| Standard Cleaning | 2 hours | $85 | Minimum order $200 |
| Standard Cleaning | 3 hours | $120 | - |
| Premium Cleaning | Per sqm | $2.50 | Min 50 sqm, max 200 sqm |

### Additional Rules & Conditions
- All prices exclude GST
- Minimum order value: $150 before taxes
- Weekend surcharge: +15% for Saturday/Sunday bookings
- Cancellation fee: 50% of service value if less than 24 hours notice
- Payment terms: Full payment required at booking

confidence: 0.95
</markdown-format-example>

${additionalContext ? `<additional-context>${additionalContext}</additional-context>` : ''}

<output-instructions>
Provide the extracted pricing information in the exact format shown above.
Include a confidence score at the end indicating how certain you are about the extraction accuracy.
If the image contains no pricing information, return an empty table with confidence: 0.0
</output-instructions>`;
  }
}
