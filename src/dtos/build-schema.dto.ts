import { IsString, IsOptional } from 'class-validator';

/**
 * Data Transfer Object for AI schema generation requests.
 *
 * This DTO encapsulates the parameters needed to generate or regenerate
 * TypeScript type definitions for pricing agent schemas. It supports
 * optional feedback for iterative improvement of generated schemas.
 */
export class BuildSchemaDto {
  @IsString()
  @IsOptional()
  feedback?: string;
}
