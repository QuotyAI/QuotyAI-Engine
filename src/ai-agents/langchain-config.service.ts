import { Injectable, Logger } from '@nestjs/common';
import { LLMConfiguration, LLMProvider, SubscriptionPlan } from '../models/mongodb.model';
import { TenantService } from '../services/tenant.service';

export interface LangchainInitModelConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  additionalConfig?: Record<string, any>;
}

@Injectable()
export class LangchainCongigService {
  private readonly logger = new Logger(LangchainCongigService.name);

  constructor(private readonly tenantService: TenantService) {}


  /**
   * Creates a default LLM configuration (Google Vertex AI with Gemini)
   */
  getDefaultLLMConfig(): LangchainInitModelConfig {
    return {
      provider: LLMProvider.GOOGLE_GENAI,
      model: 'gemini-2.5-flash',
      apiKey: '', // Will be handled by environment variables in the actual implementation
      baseUrl: undefined,
      additionalConfig: {},
    };
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
   * Gets tenant-specific LLM configuration with validation and fallback logic
   */
  async getTenantLLMConfig(tenantId?: string): Promise<LangchainInitModelConfig> {
    if (!tenantId) {
      return this.getDefaultLLMConfig(); // Use default configuration
    }

    try {
      const tenant = await this.tenantService.getTenantByIdInternal(tenantId);
      if (tenant?.builderLlmConfiguration) {
        const validation = this.validateLLMConfig(tenant.builderLlmConfiguration);
        if (validation.isValid) {
          return {
            provider: tenant.builderLlmConfiguration.provider,
            model: tenant.builderLlmConfiguration.model,
            apiKey: tenant.builderLlmConfiguration.apiKey,
            baseUrl: tenant.builderLlmConfiguration.baseUrl,
            additionalConfig: {
              modelProvider: tenant.builderLlmConfiguration.provider,
              apiKey: tenant.builderLlmConfiguration.apiKey,
              ...tenant.builderLlmConfiguration.additionalConfig,
            }
          };
        } else {
          this.logger.warn(`Invalid LLM configuration for tenant ${tenantId}: ${validation.errors.join(', ')}`);
          throw new Error(`Invalid LLM configuration for tenant ${tenantId}`);
        }
      } else if (!tenant?.subscription || !tenant.subscription.plan || tenant.subscription.plan === SubscriptionPlan.FREE) {
        throw new Error(`Tenant ${tenantId} does not have a valid subscription plan`);
      }
    } catch (error) {
      this.logger.error(`Failed to get LLM configuration for tenant ${tenantId}: ${error.message}`);
      throw error;
    }

    throw new Error(`Failed to get LLM configuration for tenant ${tenantId}: Unknown reason`);
  }  
}
