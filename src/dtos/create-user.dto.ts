import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ type: String, description: 'Firebase user ID' })
  @IsString()
  @IsNotEmpty()
  firebaseId: string;

  @ApiProperty({ type: String, description: 'User email' })
  @IsEmail()
  email: string;

  @ApiProperty({ type: String, required: false, description: 'User role', default: 'admin' })
  @IsOptional()
  @IsString()
  role?: string;
}
