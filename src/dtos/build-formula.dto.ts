import { IsString, IsOptional } from 'class-validator';

/**
 * Data Transfer Object for AI pricing function generation requests.
 *
 * This DTO encapsulates the parameters needed to generate or regenerate
 * TypeScript pricing calculation functions. It supports optional feedback
 * for iterative improvement of generated functions and business logic.
 */
export class BuildFormulaDto {
  @IsString()
  @IsOptional()
  feedback?: string;
}
