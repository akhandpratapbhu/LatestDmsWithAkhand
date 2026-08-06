import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateDirectRoomDto {
  @ValidateIf((o: CreateDirectRoomDto) => !o.contactKind && !o.contactId)
  @IsUUID()
  peerUserId?: string;

  @ValidateIf((o: CreateDirectRoomDto) => !o.peerUserId)
  @IsIn(['CUSTOMER', 'DEALER', 'EMPLOYEE'])
  contactKind?: 'CUSTOMER' | 'DEALER' | 'EMPLOYEE';

  @ValidateIf((o: CreateDirectRoomDto) => !o.peerUserId)
  @IsUUID()
  contactId?: string;
}

export class CreateGroupRoomDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  memberUserIds!: string[];
}

export class SendTextMessageDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

export class MarkReadDto {
  @IsOptional()
  @IsUUID()
  messageId?: string;
}

export class JoinRoomDto {
  @IsUUID()
  roomId!: string;
}

export class LeaveRoomDto {
  @IsUUID()
  roomId!: string;
}

export class TypingDto {
  @IsUUID()
  roomId!: string;

  @IsBoolean()
  isTyping!: boolean;
}

export class WsMessageSendDto {
  @IsUUID()
  roomId!: string;

  @IsString()
  @MinLength(1)
  body!: string;
}

export class WsMessageReadDto {
  @IsUUID()
  roomId!: string;

  @IsUUID()
  messageId!: string;
}
