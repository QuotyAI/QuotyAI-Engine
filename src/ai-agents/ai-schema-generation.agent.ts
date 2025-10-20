import { Injectable, Logger } from '@nestjs/common';
import { HumanMessage } from '@langchain/core/messages';
import { LLMService, LLMServiceConfig } from './llm.service';

export interface SchemaGenerationRequest {
  inputMessage: string;
}

export interface GeneratedSchema {
  code: string;
}

@Injectable()
export class AiSchemaGenerationAgentService {
  private readonly logger = new Logger(AiSchemaGenerationAgentService.name);

  constructor(private readonly llmService: LLMService) {
    this.logger.log('AiSchemaGenerationAgentService initialized');
  }

  async generateInputTypes(request: SchemaGenerationRequest, llmConfig?: LLMServiceConfig): Promise<GeneratedSchema> {
    this.logger.log(`Generating input types`);

    try {
      // Generate the prompt using the embedded template
      const prompt = this.generatePrompt(request.inputMessage);

      this.logger.debug(`Prompt generated: ${prompt.length} characters`);

      // Get the LLM instance
      const llm = await this.llmService.getLLM(llmConfig);

      // Generate the TypeScript types
      const result = await llm.invoke([new HumanMessage(prompt)]);

      const generatedCode = (result.content as string).replace(/^\s*```typescript\s*|\s*```\s*$/g, '').trim();
      this.logger.log(`Successfully generated input types code (${generatedCode.length} characters)`);

      return {
        code: generatedCode,
      };
    } catch (error) {
      this.logger.error(`Failed to generate input types: ${error.message}`, error.stack);
      throw error;
    }
  }

  private generatePrompt(inputMessage: string): string {
    return `<role>You are an expert TypeScript developer specializing in creating TypeScript types, interfaces, and enums from natural language service descriptions, focusing on input validation for order processing systems.</role>

<task>Based on the provided natural language description of pricing and business rules, generate a complete set of TypeScript types, interfaces, and enums for customer order input validation.

Key Requirements:
- The types must accurately represent all services, options, and constraints explicitly mentioned in the input
- Do not add any services, options, or constraints not present in the input description
- Focus on input structure only; exclude pricing calculations, tax rules, and processing fees from the types themselves
- Ensure the types are extensible for future additions while maintaining type safety

The output must include:
- OrderInput as the main interface representing the complete order structure
- Proper TypeScript interfaces, enums, and types for all input components

Output only valid TypeScript code with enums, interfaces, and type exports.</task>

<example>
Input: "General cleaning 3hrs = $100 per visit, General cleaning 4hrs = $120 per visit, General cleaning 3hrs weekly = $80 per visit, min 10 visits commitment. Deep cleaning 80-100sqm = $100, Deep cleaning > 100sqm = $1.5 per sqm, Add-ons for deep cleaning only: Curtains cleaning $20, L-Sofa cleaning $25, Upholstery 2 seats sofa $40, 3 seats sofa $50, General cleaning + Upholstery = allowed, Deep cleaning + Upholstery = not allowed, Min order $200 before taxes and processing fee, if total order < $500 tax 1.5%, if total order >= $500 tax 1.2%, processing fee is $7.5 for any service except Upholstery only, if a combination Any other service + Upholstery, then processing fee."

Output:
// --- ENUMS for Fixed Options (Essential for strong typing) ---

/** Represents the General Cleaning options by duration/frequency with commitment requirements. */
export enum GeneralCleaningOption {
    ThreeHoursSingle = '3h-single',
    FourHoursSingle = '4h-single',
    ThreeHoursWeekly = '3h-weekly',
}

/** Represents the Deep Cleaning Add-ons (only available with deep cleaning). */
export enum DeepCleaningAddonItem {
    Curtains = 'curtains',
    LSofa = 'l-sofa',
}

/** Represents the Upholstery cleaning options by item type. */
export enum UpholsteryItem {
    TwoSeatsSofa = '2-seats',
    ThreeSeatsSofa = '3-seats',
}

// --- INTERFACES ---

/**
 * Base interface for all service inputs.
 * Uses a discriminator field for type safety.
 */
export interface BaseServiceInput {
    /** Discriminator field for the service type. */
    type: 'GeneralCleaning' | 'DeepCleaning' | 'Upholstery';
    /** Optional identifier for tracking or future extension. */
    serviceId?: string;
}

/**
 * Interface for a General Cleaning input request.
 * General cleaning 3hrs/4hrs single or 3hrs weekly with minimum commitment.
 */
export interface GeneralCleaningInput extends BaseServiceInput {
    type: 'GeneralCleaning';
    option: GeneralCleaningOption;
    /** The number of times this service is requested. For weekly option, minimum 10 visits required. */
    numberOfVisits: number;
}

/**
 * Interface for a Deep Cleaning input request.
 * Priced by sqm and allows specific add-ons. Cannot be combined with Upholstery.
 */
export interface DeepCleaningInput extends BaseServiceInput {
    type: 'DeepCleaning';
    /** Area in square meters (sqm) provided by the user. */
    areaSqm: number;
    /** Add-ons for deep cleaning only. */
    addons: DeepCleaningAddonItem[];
}

/**
 * Interface for an Upholstery Cleaning input request.
 * Can be used as a standalone service or combined with General Cleaning only.
 */
export interface UpholsteryInput extends BaseServiceInput {
    type: 'Upholstery';
    item: UpholsteryItem;
    /** The number of items of this specific type (e.g., two 2-seat sofas). */
    quantity: number;
}

/**
 * Union type of all possible services a user can request.
 * This is the main type used when processing a list of services.
 */
export type ServiceInput = GeneralCleaningInput | DeepCleaningInput | UpholsteryInput;

/**
 * Interface for the full structure of an order as submitted by the client (DTO).
 * Must include at least one service and meet minimum order requirements.
 */
export interface OrderInput {
    /** A list of all requested services. Must include at least one service. */
    services: ServiceInput[];
}
</example>

<pricing-rules-in-natural-language${inputMessage}</pricing-rules-in-natural-language>

<constraints>
- Define native TypeScript enums for all fixed categorical options
- Use discriminated unions with 'type' field for type safety
- Include comprehensive JSDoc comments for all interfaces, enums, and types
- Use camelCase for all property names and enum values
- Include quantity/amount fields where multiple items of the same type can be selected
- Use descriptive enum values in kebab-case or camelCase format
- Structure output exactly as: enums first, then interfaces, then type exports
- Include array types for services and add-ons where applicable
- Ensure types are self-contained and don't reference external types
- Focus on type order definitions needed for quoting
</constraints>

<output-format>
Generate only the complete TypeScript code following the exact structure shown in the example.
Include all necessary enums, interfaces, and type exports with JSDoc comments.
No additional text, explanations, or code outside the type definitions.
The code must be syntactically correct and directly usable in a TypeScript project.
</output-format>`;
  }
}
