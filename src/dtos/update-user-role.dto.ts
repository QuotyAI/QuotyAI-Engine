import { IsEnum } from 'class-validator';

export class UpdateUserRoleDto {
  @IsEnum(['admin', 'member'])
  role: 'admin' | 'member';
}
