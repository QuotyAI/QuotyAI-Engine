import { Controller, Headers, Post, Body, HttpException, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { AiOcrPricingTablesAgentService } from '../ai-agents/ai-ocr-pricing-tables.agent';
import { ExtractedPricingTable, PricingTableExtractionRequest } from 'src/dtos/text-extraction.dto';
import { AuthGuard } from '../auth/auth.guard';
import { LangchainCongigService } from 'src/ai-agents/langchain-config.service';

@ApiTags('extraction')
@Controller('extraction')
@UseGuards(AuthGuard)
export class ExtractionController {
  private readonly logger = new Logger(ExtractionController.name);

  constructor(
    private readonly pricingTableExtractionAgent: AiOcrPricingTablesAgentService,
    private readonly llmService: LangchainCongigService,
  ) {
    this.logger.log('PricingTableExtractionController initialized');
  }

  @Post('extract')
  @ApiOperation({ summary: 'Extract pricing table from image' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Pricing table extracted successfully', type: ExtractedPricingTable })
  @ApiResponse({ status: 400, description: 'Bad request - invalid image data' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async extractPricingTable(
    @Body() body: PricingTableExtractionRequest,
    @Headers('X-Tenant-ID') tenantId?: string): Promise<ExtractedPricingTable> {
    this.logger.log(`Extracting pricing table from image (${body.imageMimeType})`);

    try {
      // Validate input
      if (!body.imageData || !body.imageMimeType) {
        this.logger.warn('Missing required fields: imageData or imageMimeType');
        throw new HttpException(
          'imageData and imageMimeType are required',
          HttpStatus.BAD_REQUEST
        );
      }

      // Validate base64 format
      if (!this.isValidBase64(body.imageData)) {
        this.logger.warn('Invalid base64 image data provided');
        throw new HttpException(
          'Invalid base64 image data',
          HttpStatus.BAD_REQUEST
        );
      }

      // Validate MIME type
      if (!this.isValidImageMimeType(body.imageMimeType)) {
        this.logger.warn(`Unsupported MIME type: ${body.imageMimeType}`);
        throw new HttpException(
          'Unsupported image MIME type. Supported types: image/jpeg, image/png, image/webp',
          HttpStatus.BAD_REQUEST
        );
      }

      const llmConfig = await this.llmService.getTenantLLMConfig(tenantId);
      const result = await this.pricingTableExtractionAgent.extractPricingTable(body, llmConfig);
      this.logger.log(`Successfully extracted pricing table (confidence: ${result.confidence})`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to extract pricing table: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to extract pricing table: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private isValidBase64(str: string): boolean {
    try {
      // Check if it's valid base64 by attempting to decode
      const decoded = Buffer.from(str, 'base64').toString('base64');
      return decoded === str;
    } catch {
      return false;
    }
  }

  private isValidImageMimeType(mimeType: string): boolean {
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return supportedTypes.includes(mimeType.toLowerCase());
  }
}
