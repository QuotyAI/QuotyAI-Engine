import { Injectable, Logger } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage } from '@langchain/core/messages';
import { UnhappyPathTestData, ExpectedErrorType } from 'src/models/mongodb.model';
import { z } from 'zod';
import { LLMService, LLMServiceConfig } from './llm.service';

const UnhappyPathTestDataSchema = z.object({
  tests: z.array(z.object({
    orderInputNaturalLanguage: z.string(),
    expectedErrorType: z.enum(Object.values(ExpectedErrorType)),
    expectedErrorReasoning: z.string(),
  }))
});

@Injectable()
export class AiUnhappyPathDatasetGenerationAgentService {
  private readonly logger = new Logger(AiUnhappyPathDatasetGenerationAgentService.name);

  constructor(private readonly llmService: LLMService) {
    this.logger.log('AiUnhappyPathDatasetGenerationAgentService initialized');
  }

  async generateUnhappyPathScenarios(pricingInNaturalLanguage: string, inputOrderSchema: string, formulaFunctionCode: string, llmConfig?: LLMServiceConfig): Promise<UnhappyPathTestData[]> {
    this.logger.log(`Generating unhappy path test scenarios for pricing function`);

    try {
      // Generate the prompt using the embedded template
      const prompt = this.generatePrompt(pricingInNaturalLanguage, inputOrderSchema, formulaFunctionCode);

      this.logger.debug(`Prompt generated: ${prompt.length} characters`);

      // Get the LLM instance
      const llm = await this.llmService.getLLM(llmConfig);

      // Generate the test scenarios as JSON
      const result = await llm.withStructuredOutput(UnhappyPathTestDataSchema, { method: 'functionCalling' }).invoke([new HumanMessage(prompt)]);
      this.logger.log(`Successfully generated unhappy path test scenarios`);

      // The result is already the parsed array
      const scenarios = Array.isArray(result.tests) ? result.tests : [];
      return scenarios;
    } catch (error) {
      this.logger.error(`Failed to generate unhappy path test scenarios: ${error.message}`, error.stack);
      throw error;
    }
  }

  private generatePrompt(pricingInNaturalLanguage: string, inputOrderSchema: string, formulaFunctionCode: string): string {
    return `<role>You are an expert QA engineer specializing in generating comprehensive negative test scenarios for pricing calculation functions in e-commerce and service-based systems.
Your task is to generate unhappy path test data that validates error handling, input validation, and edge cases that should fail or produce errors in production environments.</role>

  <task>Generate comprehensive unhappy path test scenarios as JSON array for the provided pricing function.
  Focus on scenarios where input parameters are invalid, insufficient, or violate business rules, causing the function to fail or throw errors.
  Each test scenario must include:
  - orderInputNaturalLanguage: A natural language description of the invalid or problematic input parameters
  - expectedErrorType: One of the error types (NOT_ENOUGH_DATA_TO_QUOTE, INCORRECT_ORDER_PARAMETER_VALUE, QUOTATION_RULE_VIOLATION)
  - expectedErrorReasoning: A detailed explanation of why this scenario should fail, including what specific validation should trigger the error, which business rule is violated, and why this represents a realistic failure case

  Generate scenarios that cover:
  - Missing required fields or insufficient data for quotation
  - Invalid data types, formats, or out-of-range values
  - Out of scope services, options, or combinations not supported by the pricing rules
  - Business rule violations (forbidden combinations, minimum/maximum requirements not met, etc.)
  - Boundary violations and constraint breaches (negative values, zero values where inappropriate, excessively large values)
  - Invalid service options, add-ons, or modifiers
  - Schema structure issues while maintaining valid JSON format
  - Edge cases that could cause calculation errors or unexpected behavior</task>

  <key-principles>
  - Test boundary conditions: minimum/maximum values, edge cases at limits
  - Test invalid combinations: services that cannot be combined per business rules
  - Test missing required data: essential fields omitted from valid schema structure
  - Test type/format mismatches: wrong data types or invalid formats for fields
  - Test business rule violations: constraints that must be enforced for valid orders
  - Test edge cases: unusual but possible inputs that should be rejected
  - Ensure diversity: cover all error types and different aspects of the schema/rules
  - Make scenarios realistic: represent actual user inputs that could occur in production
  - Avoid duplicates: each scenario should test a unique failure condition
  - Focus on prevention: scenarios that help catch bugs before they reach production
  </key-principles>

  <example>
  Input:
    Schema:
    Function to test:
    Pricing rules in natural language: "General cleaning 3hrs = $100 per visit, General cleaning 4hrs = $120 per visit, General cleaning 3hrs weekly = $80 per visit, min 10 visits commitment. Deep cleaning 80-100sqm = $100, Deep cleaning > 100sqm = $1.5 per sqm, Add-ons for deep cleaning only: Curtains cleaning $20, L-Sofa cleaning $25, Upholstery 2 seats sofa $40, 3 seats sofa $50, General cleaning + Upholstery = allowed, Deep cleaning + Upholstery = not allowed, Min order $200 before taxes and processing fee, if total order < $500 tax 1.5%, if total order >= $500 tax 1.2%, processing fee is $7.5 for any service except Upholstery only, if a combination Any other service + Upholstery, then processing fee."

  Output:
  { "tests": [
    {
      "orderInputNaturalLanguage": "I want general cleaning for 3 hours",
      "expectedErrorType": "NOT_ENOUGH_DATA_TO_QUOTE",
      "expectedErrorReasoning": "The schema requires numberOfVisits for GeneralCleaning, but it is missing. This should trigger insufficient data validation as the pricing calculation cannot determine visit frequency."
    },
    {
      "orderInputNaturalLanguage": "Can I get weekly cleaning for 3 hours but only 5 visits?",
      "expectedErrorType": "QUOTATION_RULE_VIOLATION",
      "expectedErrorReasoning": "Weekly general cleaning requires minimum 10 visits commitment per business rules. 5 visits violates this minimum commitment rule and should be rejected."
    },
    {
      "orderInputNaturalLanguage": "I need deep cleaning for my 90 sqm apartment and also upholstery cleaning for my 2-seater sofa",
      "expectedErrorType": "QUOTATION_RULE_VIOLATION",
      "expectedErrorReasoning": "Deep cleaning + Upholstery combination is explicitly not allowed according to business rules. This forbidden combination should be rejected to prevent invalid service pairings."
    },
    {
      "orderInputNaturalLanguage": "Please clean my house for 5 hours, one time only",
      "expectedErrorType": "INCORRECT_ORDER_PARAMETER_VALUE",
      "expectedErrorReasoning": "Only 3h and 4h duration options are available for general cleaning per pricing rules. 5h is out of scope and not supported, representing an invalid service option."
    },
    {
      "orderInputNaturalLanguage": "Just clean my 2-seater sofa upholstery please",
      "expectedErrorType": "QUOTATION_RULE_VIOLATION",
      "expectedErrorReasoning": "Minimum order value is $200 before taxes and processing fee. Upholstery 2-seats costs only $40, which violates the minimum order value business rule."
    },
    {
      "orderInputNaturalLanguage": "Deep clean my 90 sqm place and add general cleaning to it",
      "expectedErrorType": "INCORRECT_ORDER_PARAMETER_VALUE",
      "expectedErrorReasoning": "Invalid add-on specified. Add-ons are only available for specific services and must match allowed values. 'general-cleaning' is not a valid add-on option."
    },
    {
      "orderInputNaturalLanguage": "I don't know what I want yet",
      "expectedErrorType": "NOT_ENOUGH_DATA_TO_QUOTE",
      "expectedErrorReasoning": "No services specified in the order. At least one service is required for any quotation. This represents a completely empty or invalid order."
    },
    {
      "orderInputNaturalLanguage": "Clean my house for 3 hours, but I want 0 visits",
      "expectedErrorType": "QUOTATION_RULE_VIOLATION",
      "expectedErrorReasoning": "Number of visits cannot be zero. Must be at least 1 visit for any cleaning service. Zero visits represents an invalid quantity that violates basic business logic."
    },
    {
      "orderInputNaturalLanguage": "I want deep cleaning for 90 sqm and also separate upholstery cleaning for 2-seater sofa",
      "expectedErrorType": "QUOTATION_RULE_VIOLATION",
      "expectedErrorReasoning": "Deep cleaning + Upholstery combination is not allowed even when specified as separate services. This violates the service combination rules and should be rejected."
    },
    {
      "orderInputNaturalLanguage": "Deep clean my place, it's -50 square meters",
      "expectedErrorType": "INCORRECT_ORDER_PARAMETER_VALUE",
      "expectedErrorReasoning": "Area cannot be negative. Negative values are invalid for physical measurements and would cause calculation errors or nonsensical pricing."
    }
  ]}
  </example>

  <order-schema>${inputOrderSchema}</order-schema>

  <function-code>${formulaFunctionCode}</function-code>

  <pricing-rules-in-natural-language>${pricingInNaturalLanguage}</pricing-rules-in-natural-language>

  <constraints>
  - Generate test scenarios as a valid JSON object with a single key "tests" containing an array of test scenarios
  - Each scenario must have expectedErrorType, expectedErrorReasoning, and orderInputNaturalLanguage
  - expectedErrorType must be one of: NOT_ENOUGH_DATA_TO_QUOTE, INCORRECT_ORDER_PARAMETER_VALUE, QUOTATION_RULE_VIOLATION
  - Include comprehensive coverage of all error conditions mentioned in the pricing rules and schema
  - Cover missing data, invalid values, rule violations, and out-of-scope scenarios systematically
  - Test schema validation failures and business rule violations with realistic examples
  - Use descriptive, specific scenario descriptions that clearly indicate the problem
  - Generate at least 10-15 diverse test scenarios covering different error types and rule violations
  - Ensure all scenarios are realistic, testable, and represent actual production failure cases
  - Avoid duplicate scenarios that test the same condition in the same way
  - Balance coverage across all three error types while focusing on the most critical business rules
  </constraints>

  <output-format>
  Generate only a valid JSON object. No additional text, explanations, or markdown formatting.
  </output-format>`;
  }
}
