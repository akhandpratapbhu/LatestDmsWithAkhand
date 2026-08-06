import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class BookAppointmentDto {
  @IsUUID()
  slotId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  specialty!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
