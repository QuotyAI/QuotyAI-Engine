import { IsEnum, IsOptional, IsDateString, IsNumber, IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionPlan, SubscriptionStatus, BillingCycle } from '../models/mongodb.model';

export class SubscriptionDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsEnum(SubscriptionStatus)
  status: SubscriptionStatus;

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @IsNumber()
  @IsOptional()
  maxUsers?: number;

  @IsNumber()
  @IsOptional()
  maxApiKeys?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  featuresEnabled?: string[];
}

export class UpdateSubscriptionDto {
  @ValidateNested()
  @Type(() => SubscriptionDto)
  subscription: SubscriptionDto;
}
