import { ApiProperty } from '@nestjs/swagger';

export class AssignmentResultDto {
  @ApiProperty({ type: String })
  agentId: string;

  @ApiProperty({ type: String })
  datasetId: string;

  @ApiProperty({ type: String })
  tenantId: string;

  @ApiProperty({ type: Date })
  assignedAt: Date;

  @ApiProperty({ type: String })
  message: string;
}
