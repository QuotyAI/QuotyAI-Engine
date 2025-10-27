import { Injectable, Logger } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { UnhappyPathTestData, ExpectedErrorType } from 'src/models/mongodb.model';
import { z } from 'zod';
import { LangchainCongigService, LangchainInitModelConfig } from './langchain-config.service';
import { initChatModel } from 'langchain/chat_models/universal';

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

  constructor(private readonly llmService: LangchainCongigService) {
    this.logger.log('AiUnhappyPathDatasetGenerationAgentService initialized');
  }

  async generateUnhappyPathScenarios(pricingInNaturalLanguage: string, inputOrderSchema: string, formulaFunctionCode: string, llmConfig: LangchainInitModelConfig): Promise<UnhappyPathTestData[]> {
    this.logger.log(`Generating unhappy path test scenarios for pricing function`);

    try {
      // Generate the prompt using the embedded template
      const promptParts = this.generatePrompt(pricingInNaturalLanguage, inputOrderSchema, formulaFunctionCode);

      this.logger.debug(`Prompt generated: ${promptParts.systemPrompt.length + promptParts.userMessage.length} characters`);

      // Get the LLM instance
      const llm = await initChatModel(llmConfig.model, {
        ...llmConfig.additionalConfig,
      });

      // Generate the test scenarios as JSON
      const result = await llm.withStructuredOutput(UnhappyPathTestDataSchema, { method: 'functionCalling' }).invoke([
        new SystemMessage(promptParts.systemPrompt),
        new HumanMessage(promptParts.userMessage)
      ]);
      this.logger.log(`Successfully generated unhappy path test scenarios`);

      // The result is already the parsed array
      const scenarios = Array.isArray(result.tests) ? result.tests : [];
      return scenarios;
    } catch (error) {
      this.logger.error(`Failed to generate unhappy path test scenarios: ${error.message}`, error.stack);
      throw error;
    }
  }

  private generatePrompt(pricingInNaturalLanguage: string, inputOrderSchema: string, formulaFunctionCode: string): { systemPrompt: string; userMessage: string } {
    const systemPrompt = `<role>You are an expert QA engineer specializing in generating comprehensive negative test scenarios for pricing calculation functions in e-commerce and service-based systems.
Your task is to generate unhappy path test data that validates error handling, input validation, and edge cases that should fail or produce errors in production environments.</role>

  <task>Generate comprehensive unhappy path test scenarios as JSON array for the provided pricing function.
  Focus on scenarios where input parameters are invalid, insufficient, or violate business rules, causing the function to fail or throw errors.
  Each test scenario must include:
  - expectedErrorReasoning: A detailed explanation of why this scenario should fail, including what specific validation should trigger the error, which business rule is violated, and why this represents a realistic failure case
  - expectedErrorType: One of the error types (INCORRECT_INPUT_VALUE, QUOTATION_RULE_VIOLATION)
  - orderInputNaturalLanguage: A natural language order from the customer

  <error-type-definitions>
  - INCORRECT_INPUT_VALUE: Use for invalid input data such as missing required fields, incorrect data types, out-of-range values, unknown service options, malformed input, or data that doesn't conform to the expected schema structure
  - QUOTATION_RULE_VIOLATION: Use for violations of business rules such as minimum order requirements, forbidden service combinations, insufficient commitments, or other constraints that prevent valid quotation
  </error-type-definitions>

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
    Schema: Some TypeScript interfaces and types.
    Function to test: Some TypeScript function.
    Pricing rules in natural language: "General cleaning 3hrs = $100 per visit, General cleaning 4hrs = $120 per visit, General cleaning 3hrs weekly = $80 per visit, min 10 visits commitment. Deep cleaning 80-100sqm = $100, Deep cleaning > 100sqm = $1.5 per sqm, Add-ons for deep cleaning only: Curtains cleaning $20, L-Sofa cleaning $25, Upholstery 2 seats sofa $40, 3 seats sofa $50, General cleaning + Upholstery = allowed, Deep cleaning + Upholstery = not allowed, Min order $200 before taxes and processing fee, if total order < $500 tax 1.5%, if total order >= $500 tax 1.2%, processing fee is $7.5 for any service except Upholstery only, if a combination Any other service + Upholstery, then processing fee."

  Output:
  { "tests": [
    {
      "expectedErrorReasoning": "The schema requires numberOfVisits for GeneralCleaning, but it is missing. This should trigger insufficient data validation as the pricing calculation cannot determine visit frequency.",
      "expectedErrorType": "INCORRECT_INPUT_VALUE",
      "orderInputNaturalLanguage": "I want general cleaning for 3 hours"
    },
    {
      "expectedErrorReasoning": "Weekly general cleaning requires minimum 10 visits commitment per business rules. 5 visits violates this minimum commitment rule and should be rejected.",
      "expectedErrorType": "QUOTATION_RULE_VIOLATION",
      "orderInputNaturalLanguage": "Can I get weekly cleaning for 3 hours but only 5 visits?"
    },
    {
      "expectedErrorReasoning": "Deep cleaning + Upholstery combination is explicitly not allowed according to business rules. This forbidden combination should be rejected to prevent invalid service pairings.",
      "expectedErrorType": "QUOTATION_RULE_VIOLATION",
      "orderInputNaturalLanguage": "I need deep cleaning for my 90 sqm apartment and also upholstery cleaning for my 2-seater sofa"
    },
    {
      "expectedErrorReasoning": "Only 3h and 4h duration options are lsited for general cleaning per pricing rules. 5h is out of scope but not explecitely mentioned in rules.",
      "expectedErrorType": "INCORRECT_INPUT_VALUE",
      "orderInputNaturalLanguage": "Please clean my house for 5 hours, one time only"
    },
    {
      "expectedErrorReasoning": "Minimum order value is $200 before taxes and processing fee. Upholstery 2-seats costs only $40, which violates the minimum order value business rule.",
      "expectedErrorType": "QUOTATION_RULE_VIOLATION",
      "orderInputNaturalLanguage": "Just clean my 2-seater sofa upholstery please"
    },
    {
      "expectedErrorReasoning": "Invalid add-on specified. Add-ons are only available for specific services and must match allowed values. 'general-cleaning' is not a valid add-on option.",
      "expectedErrorType": "INCORRECT_INPUT_VALUE",
      "orderInputNaturalLanguage": "Deep clean my 90 sqm place and add general cleaning to it"
    },
    {
      "expectedErrorReasoning": "No services specified in the order. At least one service is required for any quotation. This represents a completely empty or invalid order.",
      "expectedErrorType": "INCORRECT_INPUT_VALUE",
      "orderInputNaturalLanguage": "I don't know what I want yet"
    },
    {
      "expectedErrorReasoning": "Number of visits cannot be zero. Must be at least 1 visit for any cleaning service. Zero visits represents an invalid quantity that violates basic business logic.",
      "expectedErrorType": "INCORRECT_INPUT_VALUE",
      "orderInputNaturalLanguage": "Clean my house for 3 hours, but I want 0 visits"
    },
    {
      "expectedErrorReasoning": "Deep cleaning + Upholstery combination is not allowed even when specified as separate services. This violates the service combination rules and should be rejected.",
      "expectedErrorType": "QUOTATION_RULE_VIOLATION",
      "orderInputNaturalLanguage": "I want deep cleaning for 90 sqm and also separate upholstery cleaning for 2-seater sofa"
    },
    {
      "expectedErrorReasoning": "Area cannot be negative. Negative values are invalid for physical measurements and would cause calculation errors or nonsensical pricing."
      "expectedErrorType": "INCORRECT_INPUT_VALUE",
      "orderInputNaturalLanguage": "Deep clean my place, it's -50 square meters"
    }
  ]}
  </example>

  <constraints>
  - Generate test scenarios as a valid JSON object with a single key "tests" containing an array of test scenarios
  - Each scenario must have expectedErrorType, expectedErrorReasoning, and orderInputNaturalLanguage
  - expectedErrorType must be one of: INCORRECT_INPUT_VALUE, QUOTATION_RULE_VIOLATION
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

    const userMessage = `<order-schema>${inputOrderSchema}</order-schema>

  <function-code>${formulaFunctionCode}</function-code>

  <pricing-rules-in-natural-language>${pricingInNaturalLanguage}</pricing-rules-in-natural-language>
  
  Generate test scenarios as a valid JSON object with a single key "tests"`;

    return { systemPrompt, userMessage };
  }
}
