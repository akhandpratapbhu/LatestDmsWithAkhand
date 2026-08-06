import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg, OrgContext, OrgGuard } from '../organizations/org.guard';
import { CallsService } from './calls.service';
import { CreateCallDto, SaveRecordingDto, ScreenShareDto } from './dto/calls.dto';

const recordingRoot = join(process.cwd(), 'uploads', 'recordings');
if (!existsSync(recordingRoot)) {
  mkdirSync(recordingRoot, { recursive: true });
}

@Controller('calls')
@UseGuards(OrgGuard)
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Post()
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateCallDto,
  ) {
    return this.calls.create(org.organizationId, user.userId, dto);
  }

  @Get('history')
  history(@CurrentOrg() org: OrgContext, @CurrentUser() user: JwtPayloadUser) {
    return this.calls.history(org.organizationId, user.userId);
  }

  @Get(':id')
  get(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
  ) {
    return this.calls.get(org.organizationId, user.userId, id);
  }

  @Post(':id/answer')
  answer(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
  ) {
    return this.calls.answer(org.organizationId, user.userId, id);
  }

  @Post(':id/reject')
  reject(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
  ) {
    return this.calls.reject(org.organizationId, user.userId, id);
  }

  @Post(':id/end')
  end(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
  ) {
    return this.calls.end(org.organizationId, user.userId, id);
  }

  @Post(':id/screen-share')
  screenShare(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: ScreenShareDto,
  ) {
    return this.calls.setScreenShare(org.organizationId, user.userId, id, dto.enabled);
  }

  @Post(':id/recording')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: recordingRoot,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname).toLowerCase() || '.webm'}`);
        },
      }),
      limits: { fileSize: 200 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.mimetype.startsWith('audio/') ||
          file.mimetype.startsWith('video/') ||
          file.mimetype === 'application/octet-stream';
        if (!ok) {
          cb(new Error('Only audio/video recordings are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  recording(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SaveRecordingDto,
  ) {
    if (!file) {
      throw new BadRequestException('Recording file is required');
    }
    const fileUrl = `/uploads/recordings/${file.filename}`;
    return this.calls.addRecording(org.organizationId, user.userId, id, {
      fileUrl,
      fileName: dto.fileName ?? file.originalname,
      durationSec: dto.durationSec,
    });
  }
}
