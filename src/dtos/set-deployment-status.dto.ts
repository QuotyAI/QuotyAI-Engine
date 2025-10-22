import { IsBoolean } from 'class-validator';

export class SetDeploymentStatusDto {
  @IsBoolean()
  isDeployed: boolean;
}
