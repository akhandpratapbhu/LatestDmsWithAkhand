import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg, OrgContext, OrgGuard } from '../organizations/org.guard';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import {
  CreateDirectRoomDto,
  CreateGroupRoomDto,
  MarkReadDto,
  SendTextMessageDto,
} from './dto/chat.dto';

const uploadRoot = join(process.cwd(), 'uploads', 'chat');
if (!existsSync(uploadRoot)) {
  mkdirSync(uploadRoot, { recursive: true });
}

@Controller('chat')
@UseGuards(OrgGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  @Get('rooms')
  listRooms(@CurrentOrg() org: OrgContext, @CurrentUser() user: JwtPayloadUser) {
    return this.chat.listRooms(org.organizationId, user.userId);
  }

  @Post('rooms/direct')
  createDirect(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateDirectRoomDto,
  ) {
    return this.chat.createDirectRoom(org.organizationId, user.userId, dto);
  }

  @Post('rooms/group')
  createGroup(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateGroupRoomDto,
  ) {
    return this.chat.createGroupRoom(org.organizationId, user.userId, dto);
  }

  @Get('rooms/:id/messages')
  listMessages(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') roomId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chat.listMessages(
      org.organizationId,
      user.userId,
      roomId,
      cursor,
      limit ? Number(limit) : 50,
    );
  }

  @Post('rooms/:id/messages')
  async sendMessage(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') roomId: string,
    @Body() dto: SendTextMessageDto,
  ) {
    const message = await this.chat.sendTextMessage(
      org.organizationId,
      user.userId,
      roomId,
      dto.body,
    );
    this.gateway.emitToRoom(roomId, 'message', message);
    return message;
  }

  @Post('rooms/:id/files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadRoot,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') roomId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const message = await this.chat.sendFileMessage(
      org.organizationId,
      user.userId,
      roomId,
      file,
    );
    this.gateway.emitToRoom(roomId, 'message', message);
    return message;
  }

  @Post('rooms/:id/read')
  async markRead(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') roomId: string,
    @Body() dto: MarkReadDto,
  ) {
    const result = await this.chat.markRead(
      org.organizationId,
      user.userId,
      roomId,
      dto.messageId,
    );
    this.gateway.emitToRoom(roomId, 'message_read', {
      ...result,
      userId: user.userId,
    });
    return result;
  }

  @Get('presence')
  async presence(@CurrentOrg() org: OrgContext) {
    const onlineUserIds = await this.chat.filterOnlineOrgMembers(
      org.organizationId,
      this.gateway.getOnlineUserIds(),
    );
    return { onlineUserIds };
  }
}
