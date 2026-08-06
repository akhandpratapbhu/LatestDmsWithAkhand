import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

/** Mirrors Prisma CallType (parent schema). */
export enum CallType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
}

/** Mirrors Prisma CallStatus (parent schema). */
export enum CallStatus {
  RINGING = 'RINGING',
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
  MISSED = 'MISSED',
  REJECTED = 'REJECTED',
}

/** Optional contact target for outbound calls (masters / chat). */
export enum CallContactKind {
  CUSTOMER = 'CUSTOMER',
  DEALER = 'DEALER',
  EMPLOYEE = 'EMPLOYEE',
}

export class CreateCallDto {
  @IsEnum(CallType)
  callType!: CallType;

  @IsOptional()
  @IsUUID()
  calleeUserId?: string;

  @IsOptional()
  @IsEnum(CallContactKind)
  contactKind?: CallContactKind;

  @IsOptional()
  @IsString()
  @MinLength(1)
  contactId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;
}

export class ScreenShareDto {
  @IsBoolean()
  enabled!: boolean;
}

export class SaveRecordingDto {
  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSec?: number;
}

export class CallIdDto {
  @IsUUID()
  callId!: string;
}

export class WebrtcSignalDto {
  @IsUUID()
  callId!: string;

  @IsUUID()
  toUserId!: string;

  @IsOptional()
  sdp?: unknown;

  @IsOptional()
  candidate?: unknown;
}

export class ScreenShareStateDto {
  @IsUUID()
  callId!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsUUID()
  toUserId?: string;
}
