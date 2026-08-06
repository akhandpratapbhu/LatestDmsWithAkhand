import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDirectRoomDto, CreateGroupRoomDto } from './dto/chat.dto';

const roomInclude = {
  members: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  },
} as const;

const messageInclude = {
  sender: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
    },
  },
  receipts: true,
} as const;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listRooms(organizationId: string, userId: string) {
    return this.prisma.chatRoom.findMany({
      where: {
        organizationId,
        members: { some: { userId } },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        ...roomInclude,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: messageInclude,
        },
      },
    });
  }

  async createDirectRoom(
    organizationId: string,
    userId: string,
    dto: CreateDirectRoomDto,
  ) {
    if (dto.peerUserId) {
      return this.findOrCreatePeerDirect(organizationId, userId, dto.peerUserId);
    }
    if (dto.contactKind && dto.contactId) {
      return this.findOrCreateContactDirect(
        organizationId,
        userId,
        dto.contactKind,
        dto.contactId,
      );
    }
    throw new BadRequestException(
      'Provide peerUserId or contactKind + contactId',
    );
  }

  async createGroupRoom(
    organizationId: string,
    userId: string,
    dto: CreateGroupRoomDto,
  ) {
    const memberIds = Array.from(new Set([userId, ...dto.memberUserIds]));
    await this.assertOrgMembers(organizationId, memberIds);

    return this.prisma.chatRoom.create({
      data: {
        organizationId,
        type: 'GROUP',
        name: dto.name.trim(),
        createdById: userId,
        members: {
          create: memberIds.map((id) => ({ userId: id })),
        },
      },
      include: roomInclude,
    });
  }

  async listMessages(
    organizationId: string,
    userId: string,
    roomId: string,
    cursor?: string,
    limit = 50,
  ) {
    await this.assertRoomMember(organizationId, roomId, userId);
    const take = Math.min(Math.max(Number(limit) || 50, 1), 100);

    let cursorFilter: Prisma.ChatMessageWhereInput = {};
    if (cursor) {
      const cursorMsg = await this.prisma.chatMessage.findFirst({
        where: { id: cursor, roomId },
      });
      if (!cursorMsg) {
        throw new NotFoundException('Cursor message not found');
      }
      cursorFilter = {
        OR: [
          { createdAt: { lt: cursorMsg.createdAt } },
          { createdAt: cursorMsg.createdAt, id: { lt: cursorMsg.id } },
        ],
      };
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { roomId, ...cursorFilter },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      include: messageInclude,
    });

    return {
      items: messages,
      nextCursor: messages.length === take ? messages[messages.length - 1]?.id : null,
    };
  }

  async sendTextMessage(
    organizationId: string,
    userId: string,
    roomId: string,
    body: string,
  ) {
    await this.assertRoomMember(organizationId, roomId, userId);
    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException('Message body is required');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        roomId,
        senderId: userId,
        body: trimmed,
        messageType: 'TEXT',
      },
      include: messageInclude,
    });

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async sendFileMessage(
    organizationId: string,
    userId: string,
    roomId: string,
    file: Express.Multer.File,
  ) {
    await this.assertRoomMember(organizationId, roomId, userId);
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const fileUrl = `/uploads/chat/${file.filename}`;
    const message = await this.prisma.chatMessage.create({
      data: {
        roomId,
        senderId: userId,
        messageType: 'FILE',
        fileUrl,
        fileName: file.originalname,
        fileMime: file.mimetype,
        fileSize: file.size,
      },
      include: messageInclude,
    });

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async markRead(
    organizationId: string,
    userId: string,
    roomId: string,
    messageId?: string,
  ) {
    await this.assertRoomMember(organizationId, roomId, userId);
    const now = new Date();

    if (messageId) {
      const message = await this.prisma.chatMessage.findFirst({
        where: { id: messageId, roomId },
      });
      if (!message) {
        throw new NotFoundException('Message not found');
      }
      await this.prisma.chatReceipt.upsert({
        where: { messageId_userId: { messageId, userId } },
        update: { readAt: now },
        create: { messageId, userId, readAt: now },
      });
    } else {
      const unread = await this.prisma.chatMessage.findMany({
        where: {
          roomId,
          senderId: { not: userId },
          receipts: { none: { userId } },
        },
        select: { id: true },
      });
      if (unread.length) {
        await this.prisma.chatReceipt.createMany({
          data: unread.map((m) => ({
            messageId: m.id,
            userId,
            readAt: now,
          })),
          skipDuplicates: true,
        });
      }
    }

    await this.prisma.chatMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastReadAt: now },
    });

    return { roomId, messageId: messageId ?? null, readAt: now };
  }

  async assertRoomMember(organizationId: string, roomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        organizationId,
        members: { some: { userId } },
      },
      select: { id: true },
    });
    if (!room) {
      throw new ForbiddenException('Not a member of this chat room');
    }
    return room;
  }

  async assertMember(roomId: string, userId: string) {
    const member = await this.prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this chat room');
    }
    return member;
  }

  async getRoomOrganizationId(roomId: string): Promise<string> {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { organizationId: true },
    });
    if (!room) {
      throw new NotFoundException('Chat room not found');
    }
    return room.organizationId;
  }

  async filterOnlineOrgMembers(organizationId: string, onlineUserIds: string[]) {
    if (!onlineUserIds.length) return [] as string[];
    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        userId: { in: onlineUserIds },
        status: 'ACTIVE',
      },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  private async findOrCreatePeerDirect(
    organizationId: string,
    userId: string,
    peerUserId: string,
  ) {
    if (peerUserId === userId) {
      throw new BadRequestException('Cannot create a direct chat with yourself');
    }
    await this.assertOrgMembers(organizationId, [peerUserId]);

    const existing = await this.prisma.chatRoom.findFirst({
      where: {
        organizationId,
        type: 'DIRECT',
        contactId: null,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: peerUserId } } },
        ],
      },
      include: roomInclude,
    });
    if (existing) {
      return existing;
    }

    return this.prisma.chatRoom.create({
      data: {
        organizationId,
        type: 'DIRECT',
        contactKind: 'USER',
        createdById: userId,
        members: {
          create: [{ userId }, { userId: peerUserId }],
        },
      },
      include: roomInclude,
    });
  }

  private async findOrCreateContactDirect(
    organizationId: string,
    userId: string,
    contactKind: 'CUSTOMER' | 'DEALER' | 'EMPLOYEE',
    contactId: string,
  ) {
    const linkedUserId = await this.resolveContactLinkedUser(
      organizationId,
      contactKind,
      contactId,
    );

    const existing = await this.prisma.chatRoom.findFirst({
      where: {
        organizationId,
        type: 'DIRECT',
        contactKind,
        contactId,
      },
      include: roomInclude,
    });

    if (existing) {
      const memberIds = new Set(existing.members.map((m) => m.userId));
      const toAdd = [userId, linkedUserId].filter(
        (id): id is string => !!id && !memberIds.has(id),
      );
      if (toAdd.length) {
        await this.prisma.chatMember.createMany({
          data: toAdd.map((id) => ({ roomId: existing.id, userId: id })),
          skipDuplicates: true,
        });
        return this.prisma.chatRoom.findUniqueOrThrow({
          where: { id: existing.id },
          include: roomInclude,
        });
      }
      return existing;
    }

    const memberUserIds = Array.from(
      new Set([userId, ...(linkedUserId ? [linkedUserId] : [])]),
    );

    return this.prisma.chatRoom.create({
      data: {
        organizationId,
        type: 'DIRECT',
        contactKind,
        contactId,
        createdById: userId,
        members: {
          create: memberUserIds.map((id) => ({ userId: id })),
        },
      },
      include: roomInclude,
    });
  }

  private async resolveContactLinkedUser(
    organizationId: string,
    contactKind: 'CUSTOMER' | 'DEALER' | 'EMPLOYEE',
    contactId: string,
  ): Promise<string | null> {
    if (contactKind === 'CUSTOMER') {
      const row = await this.prisma.customer.findFirst({
        where: { id: contactId, organizationId },
        select: { linkedUserId: true },
      });
      if (!row) throw new NotFoundException('Customer not found');
      return row.linkedUserId ?? null;
    }
    if (contactKind === 'DEALER') {
      const row = await this.prisma.dealer.findFirst({
        where: { id: contactId, organizationId },
        select: { linkedUserId: true },
      });
      if (!row) throw new NotFoundException('Dealer not found');
      return row.linkedUserId ?? null;
    }
    const row = await this.prisma.employee.findFirst({
      where: { id: contactId, organizationId },
      select: { linkedUserId: true },
    });
    if (!row) throw new NotFoundException('Employee not found');
    return row.linkedUserId ?? null;
  }

  private async assertOrgMembers(organizationId: string, userIds: string[]) {
    const unique = Array.from(new Set(userIds));
    const count = await this.prisma.organizationMember.count({
      where: {
        organizationId,
        userId: { in: unique },
        status: 'ACTIVE',
      },
    });
    if (count !== unique.length) {
      throw new BadRequestException(
        'One or more users are not active members of this organization',
      );
    }
  }
}
