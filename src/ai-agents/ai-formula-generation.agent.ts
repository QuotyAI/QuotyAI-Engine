import { Injectable, Logger } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { LLMService, LLMServiceConfig } from './llm.service';

export interface FunctionGenerationRequest {
  pricingDescription: string;
  schema: string;
}

export interface GeneratedFunction {
  code: string;
}

@Injectable()
export class AiFormulaGenerationAgentService {
  private readonly logger = new Logger(AiFormulaGenerationAgentService.name);

  constructor(private readonly llmService: LLMService) {
    this.logger.log('AiFormulaGenerationAgentService initialized');
  }

  async generatePricingFunction(request: FunctionGenerationRequest, llmConfig?: LLMServiceConfig): Promise<GeneratedFunction> {
    this.logger.log(`Generating pricing function`);

    try {
      // Generate the prompt using the embedded template
      const prompt = this.generatePrompt(request.pricingDescription, request.schema);

      this.logger.debug(`Prompt generated: system prompt ${prompt.systemPrompt.length} characters, user message ${prompt.userMessage.length} characters`);

      // Get the LLM instance
      const llm = await this.llmService.getLLM(llmConfig);

      // Generate the TypeScript function
      const result = await llm.invoke([
        new SystemMessage(prompt.systemPrompt),
        new HumanMessage(prompt.userMessage)
      ]);

      const generatedCode = (result.content as string).replace(/^\s*```typescript\s*|\s*```\s*$/g, '').replaceAll("import { z } from 'zod';", '').trim();
      this.logger.log(`Successfully generated pricing function code (${generatedCode.length} characters)`);

      return {
        code: generatedCode,
      };
    } catch (error) {
      this.logger.error(`Failed to generate pricing function: ${error.message}`, error.stack);
      throw error;
    }
  }

  private generatePrompt(pricingDescription: string, schema: string): { systemPrompt: string; userMessage: string } {
    const systemPrompt = `<role>You are an expert TypeScript developer specializing in pricing calculation functions.
Your task is to generate clean, efficient, and deterministic TypeScript functions from natural language pricing descriptions.</role>

  <task>Generate a TypeScript function that implements the pricing logic described below.
  The function must:
  - Be syntactically correct TypeScript
  - Use deterministic calculations only
  - Include proper type annotations
  - Handle edge cases gracefully
  - Use constants for fixed values
  - Include loops and conditionals where appropriate
  - Accept an OrderInput parameter that matches the provided schema structure
  - Use constant function signature function quoteOrder(order: OrderInput): QuoteResult
  - Build a comprehensive pricingCalculationBacktrace that tracks all calculation steps, validation checks, and error conditions
  - Include detailed subTasks for each major operation with descriptive operation names and explanations
  - Record all validation failures, calculation steps, and business rule violations in the backtrace
  - Ensure the backtrace provides a complete audit trail of the pricing decision process</task>

  <return-schema-object>
  interface QuoteResult {
    total?: number; // Final total price including taxes and fees
    pricingCalculationBacktrace?: BacktraceCalculationStep; // Detailed steps of the pricing calculation
    errors?: QuoteError[]; // List of error messages if any issues occurred during pricing
  }

  interface QuoteError {
    code: string; // Error code representing the type of error
    message: string; // Description of the error encountered during pricing
  }

  interface BacktraceCalculationStep {
    operation: string;
    description: string;
    subTasks?: BacktraceCalculationStep[];
  }

  export enum QuoteErrorCode {
    NOT_ENOUGH_DATA_TO_QUOTE = 'NOT_ENOUGH_DATA_TO_QUOTE',
    INCORRECT_ORDER_PARAMETER_VALUE = 'INCORRECT_ORDER_PARAMETER_VALUE',
    QUOTATION_RULE_VIOLATION = 'QUOTATION_RULE_VIOLATION'
  }
  </return-schema-object>

  <example>
  Input: "General cleaning 3hrs = $100 per visit, General cleaning 4hrs = $120 per visit, General cleaning 3hrs weekly = $80 per visit, min 10 visits commitment. Deep cleaning 80-100sqm = $100, Deep cleaning > 100sqm = $1.5 per sqm, Add-ons for deep cleaning only: Curtains cleaning $20, L-Sofa cleaning $25, Upholstery 2 seats sofa $40, 3 seats sofa $50, General cleaning + Upholstery = allowed, Deep cleaning + Upholstery = not allowed, Min order $200 before taxes and processing fee, if total order < $500 tax 1.5%, if total order >= $500 tax 1.2%, processing fee is $7.5 for any service except Upholstery only, if a combination Any other service + Upholstery, then processing fee."

  Output:
  function quoteOrder(order: OrderInput): QuoteResult {
    const GENERAL_CLEANING_3H_SINGLE = 100;
    const GENERAL_CLEANING_4H_SINGLE = 120;
    const GENERAL_CLEANING_3H_WEEKLY = 80;
    const DEEP_CLEANING_BASE_80_100 = 100;
    const DEEP_CLEANING_PER_SQM_OVER_100 = 1.5;
    const CURTAINS_ADDON = 20;
    const L_SOFA_ADDON = 25;
    const UPHOLSTERY_2_SEATS = 40;
    const UPHOLSTERY_3_SEATS = 50;
    const MINIMUM_ORDER = 200;
    const TAX_RATE_UNDER_500 = 0.015;
    const TAX_RATE_500_AND_OVER = 0.012;
    const PROCESSING_FEE = 7.5;

    const errors: QuoteError[] = [];
    const pricingCalculationBacktrace: BacktraceCalculationStep = { operation: 'start', description: 'Starting pricing calculation', subTasks: [] };

    pricingCalculationBacktrace.subTasks.push({ operation: 'validation', description: 'Validating order rules and combinations', subTasks: [] });

    // Validate service combinations
    const hasDeepCleaning = order.services.some(service => service.type === 'DeepCleaning');
    const hasUpholstery = order.services.some(service => service.type === 'Upholstery');

    if (hasDeepCleaning && hasUpholstery) {
      errors.push({ code: 'QUOTATION_RULE_VIOLATION', message: 'Deep cleaning and Upholstery services cannot be combined in the same order' });
      pricingCalculationBacktrace.subTasks[0].subTasks.push({ operation: 'combination_violation', description: 'ERROR: Deep cleaning and Upholstery services cannot be combined', subTasks: [] });
    } else {
      pricingCalculationBacktrace.subTasks[0].subTasks.push({ operation: 'combination_check', description: 'Combination check passed - no prohibited service combinations found', subTasks: [] });
    }

    // Validate minimum commitment for weekly service
    const weeklyService = order.services.find(service =>
      service.type === 'GeneralCleaning' &&
      (service as GeneralCleaningInput).option === '3h-weekly'
    );

    if (weeklyService) {
      const generalCleaning = weeklyService as GeneralCleaningInput;
      if (generalCleaning.numberOfVisits < 10) {
        errors.push({ code: 'QUOTATION_RULE_VIOLATION', message: 'Weekly general cleaning requires a minimum commitment of 10 visits' });
        pricingCalculationBacktrace.subTasks[0].subTasks.push({ operation: 'commitment_violation', description: 'ERROR: Weekly service found with ' + generalCleaning.numberOfVisits + ' visits, minimum required: 10', subTasks: [] });
      } else {
        pricingCalculationBacktrace.subTasks[0].subTasks.push({ operation: 'commitment_check', description: 'Commitment check passed - weekly service has ' + generalCleaning.numberOfVisits + ' visits (minimum: 10)', subTasks: [] });
      }
    } else {
      pricingCalculationBacktrace.subTasks[0].subTasks.push({ operation: 'commitment_check', description: 'No weekly services found - commitment check not applicable', subTasks: [] });
    }

    if (errors.length > 0) {
      return { errors };
    }

    pricingCalculationBacktrace.subTasks.push({ operation: 'subtotal_calculation', description: 'Calculating subtotal for all services', subTasks: [] });

    let subtotal = 0;

    for (const service of order.services) {
      pricingCalculationBacktrace.subTasks[1].subTasks.push({ operation: 'service_' + service.type.toLowerCase(), description: 'Calculating ' + service.type + ' service', subTasks: [] });

      switch (service.type) {
        case 'GeneralCleaning':
          const generalCleaning = service as GeneralCleaningInput;
          switch (generalCleaning.option) {
            case '3h-single':
              subtotal += GENERAL_CLEANING_3H_SINGLE * generalCleaning.numberOfVisits;
              pricingCalculationBacktrace.subTasks[1].subTasks[pricingCalculationBacktrace.subTasks[1].subTasks.length - 1].subTasks.push({ operation: '3h_single_calc', description: 'General cleaning 3h single: ' + GENERAL_CLEANING_3H_SINGLE + ' * ' + generalCleaning.numberOfVisits + ' = ' + (GENERAL_CLEANING_3H_SINGLE * generalCleaning.numberOfVisits), subTasks: [] });
              break;
            case '4h-single':
              subtotal += GENERAL_CLEANING_4H_SINGLE * generalCleaning.numberOfVisits;
              pricingCalculationBacktrace.subTasks[1].subTasks[pricingCalculationBacktrace.subTasks[1].subTasks.length - 1].subTasks.push({ operation: '4h_single_calc', description: 'General cleaning 4h single: ' + GENERAL_CLEANING_4H_SINGLE + ' * ' + generalCleaning.numberOfVisits + ' = ' + (GENERAL_CLEANING_4H_SINGLE * generalCleaning.numberOfVisits), subTasks: [] });
              break;
            case '3h-weekly':
              subtotal += GENERAL_CLEANING_3H_WEEKLY * generalCleaning.numberOfVisits;
              pricingCalculationBacktrace.subTasks[1].subTasks[pricingCalculationBacktrace.subTasks[1].subTasks.length - 1].subTasks.push({ operation: '3h_weekly_calc', description: 'General cleaning 3h weekly: ' + GENERAL_CLEANING_3H_WEEKLY + ' * ' + generalCleaning.numberOfVisits + ' = ' + (GENERAL_CLEANING_3H_WEEKLY * generalCleaning.numberOfVisits), subTasks: [] });
              break;
            default:
              errors.push({ code: 'INCORRECT_ORDER_PARAMETER_VALUE', message: 'Unknown general cleaning option: ' + generalCleaning.option });
          }
          break;

        case 'DeepCleaning':
          const deepCleaning = service as DeepCleaningInput;
          if (deepCleaning.areaSqm <= 100) {
            subtotal += DEEP_CLEANING_BASE_80_100;
            pricingCalculationBacktrace.subTasks[1].subTasks[pricingCalculationBacktrace.subTasks[1].subTasks.length - 1].subTasks.push({ operation: 'deep_cleaning_base', description: 'Deep cleaning base for <=100sqm: ' + DEEP_CLEANING_BASE_80_100, subTasks: [] });
          } else {
            subtotal += deepCleaning.areaSqm * DEEP_CLEANING_PER_SQM_OVER_100;
            pricingCalculationBacktrace.subTasks[1].subTasks[pricingCalculationBacktrace.subTasks[1].subTasks.length - 1].subTasks.push({ operation: 'deep_cleaning_per_sqm', description: 'Deep cleaning per sqm >100: ' + deepCleaning.areaSqm + ' * ' + DEEP_CLEANING_PER_SQM_OVER_100 + ' = ' + (deepCleaning.areaSqm * DEEP_CLEANING_PER_SQM_OVER_100), subTasks: [] });
          }

          for (const addon of deepCleaning.addons) {
            switch (addon) {
              case 'curtains':
                subtotal += CURTAINS_ADDON;
                pricingCalculationBacktrace.subTasks[1].subTasks[pricingCalculationBacktrace.subTasks[1].subTasks.length - 1].subTasks.push({ operation: 'addon_curtains', description: 'Curtains addon: ' + CURTAINS_ADDON, subTasks: [] });
                break;
              case 'l-sofa':
                subtotal += L_SOFA_ADDON;
                pricingCalculationBacktrace.subTasks[1].subTasks[pricingCalculationBacktrace.subTasks[1].subTasks.length - 1].subTasks.push({ operation: 'addon_l_sofa', description: 'L-Sofa addon: ' + L_SOFA_ADDON, subTasks: [] });
                break;
              default:
                errors.push({ code: 'INCORRECT_ORDER_PARAMETER_VALUE', message: 'Unknown deep cleaning addon: ' + addon });
            }
          }
          break;

        case 'Upholstery':
          const upholstery = service as UpholsteryInput;
          switch (upholstery.item) {
            case '2-seats':
              subtotal += UPHOLSTERY_2_SEATS * upholstery.quantity;
              pricingCalculationBacktrace.subTasks[1].subTasks[pricingCalculationBacktrace.subTasks[1].subTasks.length - 1].subTasks.push({ operation: 'upholstery_2_seats', description: 'Upholstery 2 seats: ' + UPHOLSTERY_2_SEATS + ' * ' + upholstery.quantity + ' = ' + (UPHOLSTERY_2_SEATS * upholstery.quantity), subTasks: [] });
              break;
            case '3-seats':
              subtotal += UPHOLSTERY_3_SEATS * upholstery.quantity;
              pricingCalculationBacktrace.subTasks[1].subTasks[pricingCalculationBacktrace.subTasks[1].subTasks.length - 1].subTasks.push({ operation: 'upholstery_3_seats', description: 'Upholstery 3 seats: ' + UPHOLSTERY_3_SEATS + ' * ' + upholstery.quantity + ' = ' + (UPHOLSTERY_3_SEATS * upholstery.quantity), subTasks: [] });
              break;
            default:
              errors.push({ code: 'INCORRECT_ORDER_PARAMETER_VALUE', message: 'Unknown upholstery item: ' + upholstery.item });
          }
          break;

        default:
          errors.push({ code: 'INCORRECT_ORDER_PARAMETER_VALUE', message: 'Unknown service type: ' + service.type });
      }
    }

    if (errors.length > 0) {
      return { errors };
    }

    pricingCalculationBacktrace.subTasks.push({ operation: 'minimum_order_check', description: 'Checking minimum order requirement', subTasks: [] });

    pricingCalculationBacktrace.subTasks[2].subTasks.push({ operation: 'check_subtotal', description: 'Subtotal: ' + subtotal + ', minimum: ' + MINIMUM_ORDER, subTasks: [] });

    if (subtotal < MINIMUM_ORDER) {
      return { errors: [{ code: 'QUOTATION_RULE_VIOLATION', message: 'Minimum order subtotal must be $' + MINIMUM_ORDER + ' before taxes and processing fee' }] };
    }

    // Calculate processing fee
    let processingFee = 0;
    const hasOnlyUpholstery = order.services.length === 1 && hasUpholstery;
    const hasUpholsteryWithOtherServices = hasUpholstery && order.services.length > 1;

    if (!hasOnlyUpholstery && (order.services.length > 0 || hasUpholsteryWithOtherServices)) {
      processingFee = PROCESSING_FEE;
    }

    pricingCalculationBacktrace.subTasks.push({ operation: 'processing_fee_calculation', description: 'Calculating processing fee', subTasks: [] });

    pricingCalculationBacktrace.subTasks[3].subTasks.push({ operation: 'fee_logic', description: 'Processing fee: ' + processingFee, subTasks: [] });

    // Calculate tax
    const taxableAmount = subtotal + processingFee;
    const taxRate = taxableAmount >= 500 ? TAX_RATE_500_AND_OVER : TAX_RATE_UNDER_500;
    const taxAmount = taxableAmount * taxRate;

    pricingCalculationBacktrace.subTasks.push({ operation: 'tax_calculation', description: 'Calculating tax amount', subTasks: [] });

    pricingCalculationBacktrace.subTasks[4].subTasks.push({ operation: 'tax_rate', description: 'Tax rate: ' + (taxRate * 100) + '% on ' + taxableAmount, subTasks: [] });

    pricingCalculationBacktrace.subTasks[4].subTasks.push({ operation: 'tax_amount', description: 'Tax amount: ' + taxAmount, subTasks: [] });

    // Final total
    const finalTotal = taxableAmount + taxAmount;

    pricingCalculationBacktrace.subTasks.push({ operation: 'total_calculation', description: 'Calculating final total', subTasks: [] });

    pricingCalculationBacktrace.subTasks[5].subTasks.push({ operation: 'final_total', description: 'Final total: ' + finalTotal, subTasks: [] });

    return { total: finalTotal, pricingCalculationBacktrace: pricingCalculationBacktrace };
  }
  </example>

  <constraints>
  - Use const for all fixed values
  - Include input validation
  - Use descriptive variable names
  - Handle all edge cases mentioned in the description
  - Return number or throw Error with descriptive message
  - Function name should be descriptive and camelCase
  - Accept OrderInput parameter that matches the schema structure
  - Return QuoteResult object with detailed breakdown
  - Use proper type casting for discriminated union types
  - Include proper error handling for unknown enum values
  - Calculate totals for multiple services in the order
  - Use string literals for enum values instead of enum references
  - Use string concatenation for error messages instead of template literals
  - Build comprehensive pricingCalculationBacktrace with hierarchical subTasks
  - Record all validation steps, calculation operations, and error conditions in backtrace
  - Include descriptive operation names and explanations for each backtrace step
  - Ensure backtrace captures both successful calculations and validation failures
  - Use consistent operation naming conventions (snake_case for operations)
  - Include calculation formulas and values in backtrace descriptions
  - Track error conditions separately from successful operations in backtrace
  </constraints>

  <output-format>
  Generate the complete TypeScript function only, no additional text or explanations.
  Do not return OrderInput or QuoteResult definitions.
  </output-format>`;

    const userMessage = `<order-schema>${schema}</order-schema>

  <pricing-rules-in-natural-language>${pricingDescription}</pricing-rules-in-natural-language>
  
  Start next message with the function definition:
  function quoteOrder(order: OrderInput): QuoteResult {`;

    return { systemPrompt, userMessage };
  }
}
