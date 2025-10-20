import { Injectable, Logger } from '@nestjs/common';
import { initChatModel } from 'langchain/chat_models/universal';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LLMConfiguration, LLMProvider } from '../models/mongodb.model';

export interface LLMServiceConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  additionalConfig?: Record<string, any>;
}

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);

  /**
   * Creates a configured LLM instance based on the provider configuration
   */
  async createLLM(config: LLMServiceConfig): Promise<BaseChatModel> {
    this.logger.debug(`Creating LLM instance for provider: ${config.provider}, model: ${config.model}`);

    switch (config.provider) {
      case LLMProvider.GOOGLE:
        return await initChatModel(config.model, {
          modelProvider: 'google_vertexai',
          ...config.additionalConfig,
        });

      case LLMProvider.OPENAI:
      case LLMProvider.ANTHROPIC:
      case LLMProvider.AZURE_OPENAI:
        // TODO: Install and implement support for these providers
        throw new Error(`Provider ${config.provider} is not yet supported. Only Google Vertex AI is currently available.`);

      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }

  /**
   * Creates a default LLM configuration (Google Vertex AI with Gemini)
   */
  getDefaultLLMConfig(): LLMServiceConfig {
    return {
      provider: LLMProvider.GOOGLE,
      model: 'gemini-2.5-flash',
      apiKey: '', // Will be handled by environment variables in the actual implementation
    };
  }

  /**
   * Gets an LLM instance from configuration, with fallback to default
   */
  async getLLM(llmConfig?: LLMServiceConfig): Promise<BaseChatModel> {
    if (llmConfig) {
      return await this.createLLM(llmConfig);
    }
    return await this.createLLM(this.getDefaultLLMConfig());
  }

  /**
   * Validates LLM configuration
   */
  validateLLMConfig(config: LLMConfiguration): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.provider) {
      errors.push('Provider is required');
    } else if (!Object.values(LLMProvider).includes(config.provider)) {
      errors.push(`Invalid provider: ${config.provider}`);
    }

    if (!config.model) {
      errors.push('Model is required');
    }

    if (!config.apiKey) {
      errors.push('API key is required');
    }

    if (config.provider === LLMProvider.AZURE_OPENAI && !config.baseUrl) {
      errors.push('Base URL is required for Azure OpenAI provider');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extracts Azure instance name from base URL
   * e.g., https://my-instance.openai.azure.com/ -> my-instance
   */
  private extractInstanceName(baseUrl: string): string {
    try {
      const url = new URL(baseUrl);
      const hostname = url.hostname;
      const parts = hostname.split('.');
      return parts[0];
    } catch (error) {
      throw new Error(`Invalid Azure OpenAI base URL: ${baseUrl}`);
    }
  }
}
