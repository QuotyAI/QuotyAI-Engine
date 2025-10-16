import { IsString, IsNotEmpty } from 'class-validator';

export class CreatePricingAgentDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
