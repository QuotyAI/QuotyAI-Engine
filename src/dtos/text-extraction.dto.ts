import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class PricingTableExtractionRequest {
  @IsString()
  imageData: string; // Base64 encoded image data
  @IsString()
  imageMimeType: string; // e.g., 'image/jpeg', 'image/png'
  @IsString()
  @IsOptional()
  additionalContext?: string; // Optional context about the pricing table
}

export class ExtractedPricingTable {
  @ApiProperty()
  markdown: string; // Markdown formatted pricing table
  @ApiProperty()
  rawText: string; // Raw extracted text for reference
  @ApiProperty()
  confidence: number; // Confidence score (0-1) of the extraction
}
