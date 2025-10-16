import { Injectable, Logger } from '@nestjs/common';
import * as ts from 'typescript';
import * as vm from 'vm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CheckpointHappyPathTestRun, CheckpointUnhappyPathTestRun, ExpectedErrorType, QuoteResult, TestResult } from '../models/mongodb.model';

@Injectable()
export class DynamicRunnerService {
  private readonly logger = new Logger(DynamicRunnerService.name);

  constructor() {
    this.logger.log('DynamicRunnerService initialized');
  }

  /**
   * Transpiles TypeScript code to JavaScript
   */
  private transpileTypeScript(code: string): string {
    this.logger.debug('Transpiling TypeScript code');

    let result = ts.transpile(code, {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2015,
      strict: false,
      noImplicitAny: false,
      removeComments: false,
      preserveConstEnums: true
    });

    result = result.replaceAll('use strict', '');
    result = result.replaceAll('Object.defineProperty(exports, "__esModule", { value: true });', '');
    result = result.replaceAll('exports.', '');
    result = result.trim();

    this.logger.debug(`Transpiled code length: ${result.length}`);
    //first 5 lines of the transpiled code
    this.logger.debug('Transpiled code snippet:', result.split('\n').slice(0, 5).join('\n'));
    return result;
  }

  /**
   * Executes JavaScript code in a sandboxed environment
   */
  private executeInSandbox(code: string, input: any): QuoteResult {
    this.logger.debug('Executing code in sandbox');

    // Create a sandbox context
    const sandbox = {
      console: {
        log: (...args: any[]) => {
          this.logger.debug('Sandbox log:', ...args);
        },
        error: (...args: any[]) => {
          this.logger.error('Sandbox error:', ...args);
        },
        warn: (...args: any[]) => {
          this.logger.warn('Sandbox warn:', ...args);
        },
      },
      process: {
        env: {},
      },
      Buffer: Buffer,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      setInterval: setInterval,
      clearInterval: clearInterval,
      Date: Date,
      Math: Math,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      RegExp: RegExp,
      JSON: JSON,
      Error: Error,
      TypeError: TypeError,
      ReferenceError: ReferenceError,
      RangeError: RangeError,
      SyntaxError: SyntaxError,
      URIError: URIError,
      EvalError: EvalError,
    };

    // Create the script
    const script = new vm.Script(code);

    // Create context
    const context = vm.createContext(sandbox);

    // Execute the script
    script.runInContext(context);

    // Get the quoteOrder function
    const quoteOrder = context.quoteOrder;

    if (typeof quoteOrder !== 'function') {
      throw new Error('quoteOrder function not found in executed code');
    }

    // Execute the function with the input
    const result = quoteOrder(input);

    this.logger.debug('Function executed successfully');
    return result;
  }

  /**
   * Saves generated script to file for troubleshooting
   */
  private async saveScriptForTroubleshooting(code: string, testId: string, error: Error): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `troubleshooting-script-${testId}-${timestamp}.js`;
      const filepath = path.join(process.cwd(), 'troubleshooting-scripts', filename);

      // Ensure directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true });

      const content = `// Error: ${error.message}\n// Test ID: ${testId}\n// Timestamp: ${new Date().toISOString()}\n\n${code}`;
      await fs.writeFile(filepath, content, 'utf8');

      this.logger.warn(`Saved troubleshooting script to: ${filepath}`);
    } catch (saveError) {
      this.logger.error('Failed to save troubleshooting script:', saveError);
    }
  }

  /**
   * Runs a single happy path test
   */
  public async runHappyPathTest(
    test: CheckpointHappyPathTestRun,
    functionCode: string,
    functionSchema?: string,
    expectedTotal?: number
  ): Promise<TestResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    let jsCode: string = '';

    try {
      this.logger.debug(`Running happy path test: ${test._id}`);

      // Combine schema and function code
      const fullCode = functionSchema ? `${functionSchema}\n\n${functionCode}` : functionCode;

      // Transpile the code
      jsCode = this.transpileTypeScript(fullCode);

      // Execute the function
      const result: QuoteResult = this.executeInSandbox(jsCode, test.functionInputParams);

      const executionTime = Date.now() - startTime;

      // Check if test passed
      const passed = result.total === expectedTotal;

      return {
        passed,
        functionResult: result
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Enhanced error logging for troubleshooting
      this.logger.error(`Happy path test failed for test ${test._id ? test._id.toString() : 'unknown'}:`, {
        error: error.message,
        stack: error.stack,
        testInput: JSON.stringify(test.functionInputParams, null, 2),
        expectedTotal: expectedTotal,
        jsCodeLength: jsCode.length,
        jsCodeSnippet: jsCode.substring(0, 500) + (jsCode.length > 500 ? '...' : ''),
      });

      logs.push(`Execution error: ${error.message}`);
      logs.push(`Test input: ${JSON.stringify(test.functionInputParams)}`);
      logs.push(`Expected total: ${expectedTotal}`);
      logs.push(`JS code length: ${jsCode.length} characters`);
      if (error.stack) {
        logs.push(`Stack trace: ${error.stack}`);
      }

      // Save script for troubleshooting
      if (jsCode) {
        await this.saveScriptForTroubleshooting(jsCode, test._id ? test._id.toString() : 'unknown', error);
      }

      return {
        passed: false,
        runnerException: error
      }
    }
  }

  /**
   * Executes a pricing function without testing (for playground use)
   */
  public async executePricingFunction(
    functionCode: string,
    functionSchema: string | undefined,
    inputParams: any
  ): Promise<QuoteResult> {
    try {
      this.logger.debug('Executing pricing function for playground');

      // Combine schema and function code
      const fullCode = functionSchema ? `${functionSchema}\n\n${functionCode}` : functionCode;

      // Transpile the code
      const jsCode = this.transpileTypeScript(fullCode);

      // Execute the function
      const result: QuoteResult = this.executeInSandbox(jsCode, inputParams);

      this.logger.debug('Pricing function executed successfully');
      return result;
    } catch (error) {
      this.logger.error('Failed to execute pricing function:', {
        error: error.message,
        stack: error.stack,
        inputParams: JSON.stringify(inputParams, null, 2),
      });

      throw error;
    }
  }

  /**
   * Runs a single unhappy path test
   */
  public async runUnhappyPathTest(
    test: CheckpointUnhappyPathTestRun,
    functionCode: string,
    functionSchema?: string,
    expectedErrorType?: ExpectedErrorType
  ): Promise<TestResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    let jsCode: string = '';

    try {
      this.logger.debug(`Running unhappy path test: ${test._id}`);

      // Combine schema and function code
      const fullCode = functionSchema ? `${functionSchema}\n\n${functionCode}` : functionCode;

      // Transpile the code
      jsCode = this.transpileTypeScript(fullCode);

      // Execute the function
      const result: QuoteResult = this.executeInSandbox(jsCode, test.functionInputParams);

      const executionTime = Date.now() - startTime;

      // For unhappy path tests, we expect errors
      const hasExpectedError = result.errors && result.errors.some(error => {
        switch (expectedErrorType) {
          case ExpectedErrorType.NOT_ENOUGH_DATA_TO_QUOTE:
            return error.code === 'NOT_ENOUGH_DATA_TO_QUOTE';
          case ExpectedErrorType.INCORRECT_ORDER_PARAMETER_VALUE:
            return error.code === 'INCORRECT_ORDER_PARAMETER_VALUE';
          case ExpectedErrorType.QUOTATION_RULE_VIOLATION:
            return error.code === 'QUOTATION_RULE_VIOLATION';
          default:
            return false;
        }
      });

      const passed = hasExpectedError === true;

      return {
        passed: passed,
        functionResult: result
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Enhanced error logging for troubleshooting
      this.logger.error(`Unhappy path test failed for test ${test._id ? test._id.toString() : 'unknown'}:`, {
        error: error.message,
        stack: error.stack,
        testInput: JSON.stringify(test.functionInputParams, null, 2),
        expectedErrorType: expectedErrorType,
        jsCodeLength: jsCode.length,
        jsCodeSnippet: jsCode.substring(0, 500) + (jsCode.length > 500 ? '...' : ''),
      });

      logs.push(`Execution error: ${error.message}`);
      logs.push(`Test input: ${JSON.stringify(test.functionInputParams)}`);
      logs.push(`Expected error type: ${expectedErrorType}`);
      logs.push(`JS code length: ${jsCode.length} characters`);
      if (error.stack) {
        logs.push(`Stack trace: ${error.stack}`);
      }

      // Save script for troubleshooting
      if (jsCode) {
        await this.saveScriptForTroubleshooting(jsCode, test._id ? test._id.toString() : 'unknown', error);
      }

      return {
        passed: false,
        runnerException: error
      };
    }
  }
}
