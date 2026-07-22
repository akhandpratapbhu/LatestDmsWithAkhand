import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CallsGateway } from './calls.gateway';
import { CallStatus, CreateCallDto } from './dto/calls.dto';

type CallSessionRow = {
  id: string;
  organizationId: string;
  roomId: string | null;
  callerId: string;
  calleeUserId: string | null;
  contactKind: string | null;
  contactId: string | null;
  callType: string;
  status: string;
  screenShare: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  participants?: Array<{ userId: string; joinedAt: Date | null; leftAt: Date | null }>;
  recordings?: unknown[];
};

/** Prisma delegates land after parent schema generate; keep a narrow typed surface. */
type CallsDb = {
  callSession: {
    create: (args: unknown) => Promise<CallSessionRow>;
    findFirst: (args: unknown) => Promise<CallSessionRow | null>;
    findMany: (args: unknown) => Promise<CallSessionRow[]>;
    update: (args: unknown) => Promise<CallSessionRow>;
  };
  callParticipant: {
    create: (args: unknown) => Promise<unknown>;
    createMany: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<unknown>;
  };
  callRecording: {
    create: (args: unknown) => Promise<unknown>;
  };
};

const callInclude = {
  participants: true,
  recordings: { orderBy: { createdAt: 'desc' as const } },
};

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => CallsGateway))
    private readonly gateway: CallsGateway,
  ) {}

  private get db() {
    return this.prisma as unknown as CallsDb;
  }

  async create(organizationId: string, callerId: string, dto: CreateCallDto) {
    if (!dto.calleeUserId && !(dto.contactKind && dto.contactId)) {
      throw new BadRequestException(
        'Provide calleeUserId or contactKind + contactId',
      );
    }
    if (dto.calleeUserId === callerId) {
      throw new BadRequestException('Cannot call yourself');
    }

    if (dto.calleeUserId) {
      const member = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: dto.calleeUserId,
          },
        },
      });
      if (!member) {
        throw new BadRequestException('Callee is not a member of this organization');
      }
    }

    const call = await this.db.callSession.create({
      data: {
        organizationId,
        roomId: dto.roomId ?? null,
        callerId,
        calleeUserId: dto.calleeUserId ?? null,
        contactKind: dto.contactKind ?? null,
        contactId: dto.contactId ?? null,
        callType: dto.callType,
        status: CallStatus.RINGING,
        screenShare: false,
        participants: {
          create: [
            { userId: callerId, joinedAt: new Date() },
            ...(dto.calleeUserId ? [{ userId: dto.calleeUserId }] : []),
          ],
        },
      },
      include: callInclude,
    });

    if (dto.calleeUserId) {
      this.gateway.emitToUser(dto.calleeUserId, 'call_invite', call);
    }

    return call;
  }

  history(organizationId: string, userId: string) {
    return this.db.callSession.findMany({
      where: {
        organizationId,
        OR: [
          { callerId: userId },
          { calleeUserId: userId },
          { participants: { some: { userId } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: callInclude,
    });
  }

  async get(organizationId: string, userId: string, id: string) {
    const call = await this.db.callSession.findFirst({
      where: { id, organizationId },
      include: callInclude,
    });
    if (!call) throw new NotFoundException('Call not found');
    this.assertParticipant(call, userId);
    return call;
  }

  async answer(organizationId: string, userId: string, id: string) {
    const call = await this.requireCall(organizationId, id);
    return this.answerCall(call, userId);
  }

  async answerByUser(userId: string, id: string) {
    const call = await this.requireCallById(id);
    return this.answerCall(call, userId);
  }

  async reject(organizationId: string, userId: string, id: string) {
    const call = await this.requireCall(organizationId, id);
    return this.rejectCall(call, userId);
  }

  async rejectByUser(userId: string, id: string) {
    const call = await this.requireCallById(id);
    return this.rejectCall(call, userId);
  }

  async end(organizationId: string, userId: string, id: string) {
    const call = await this.requireCall(organizationId, id);
    return this.endCall(call, userId);
  }

  async endByUser(userId: string, id: string) {
    const call = await this.requireCallById(id);
    return this.endCall(call, userId);
  }

  async setScreenShare(
    organizationId: string,
    userId: string,
    id: string,
    enabled: boolean,
  ) {
    const call = await this.requireCall(organizationId, id);
    return this.updateScreenShare(call, userId, enabled);
  }

  async setScreenShareByUser(userId: string, id: string, enabled: boolean) {
    const call = await this.requireCallById(id);
    return this.updateScreenShare(call, userId, enabled);
  }

  async addRecording(
    organizationId: string,
    userId: string,
    id: string,
    input: { fileUrl: string; fileName?: string; durationSec?: number },
  ) {
    const call = await this.requireCall(organizationId, id);
    this.assertParticipant(call, userId);

    const recording = await this.db.callRecording.create({
      data: {
        callId: call.id,
        fileUrl: input.fileUrl,
        fileName: input.fileName ?? null,
        durationSec: input.durationSec ?? null,
      },
    });

    return this.db.callSession.findFirst({
      where: { id: call.id },
      include: callInclude,
    }).then((updated) => ({ call: updated, recording }));
  }

  private async answerCall(call: CallSessionRow, userId: string) {
    this.assertCanAnswer(call, userId);
    if (call.status !== CallStatus.RINGING) {
      throw new BadRequestException('Call is not ringing');
    }

    await this.db.callParticipant.updateMany({
      where: { callId: call.id, userId },
      data: { joinedAt: new Date() },
    });

    const updated = await this.db.callSession.update({
      where: { id: call.id },
      data: {
        status: CallStatus.ACTIVE,
        startedAt: new Date(),
      },
      include: callInclude,
    });

    this.notifyPeers(updated, userId, 'call_accept', updated);
    return updated;
  }

  private async rejectCall(call: CallSessionRow, userId: string) {
    this.assertCanAnswer(call, userId);
    if (call.status !== CallStatus.RINGING) {
      throw new BadRequestException('Call is not ringing');
    }

    const updated = await this.db.callSession.update({
      where: { id: call.id },
      data: {
        status: CallStatus.REJECTED,
        endedAt: new Date(),
      },
      include: callInclude,
    });

    this.notifyPeers(updated, userId, 'call_reject', updated);
    return updated;
  }

  private async endCall(call: CallSessionRow, userId: string) {
    this.assertParticipant(call, userId);
    if (
      call.status === CallStatus.ENDED ||
      call.status === CallStatus.REJECTED ||
      call.status === CallStatus.MISSED
    ) {
      throw new BadRequestException('Call already finished');
    }

    const nextStatus =
      call.status === CallStatus.RINGING ? CallStatus.MISSED : CallStatus.ENDED;

    await this.db.callParticipant.updateMany({
      where: { callId: call.id, leftAt: null },
      data: { leftAt: new Date() },
    });

    const updated = await this.db.callSession.update({
      where: { id: call.id },
      data: {
        status: nextStatus,
        endedAt: new Date(),
        screenShare: false,
      },
      include: callInclude,
    });

    this.notifyPeers(updated, userId, 'call_end', updated);
    return updated;
  }

  private async updateScreenShare(
    call: CallSessionRow,
    userId: string,
    enabled: boolean,
  ) {
    this.assertParticipant(call, userId);
    if (call.status !== CallStatus.ACTIVE) {
      throw new BadRequestException('Screen share only allowed on active calls');
    }

    const updated = await this.db.callSession.update({
      where: { id: call.id },
      data: { screenShare: enabled },
      include: callInclude,
    });

    this.notifyPeers(updated, userId, 'screen_share_state', {
      callId: updated.id,
      enabled,
      fromUserId: userId,
    });
    return updated;
  }

  private async requireCall(organizationId: string, id: string) {
    const call = await this.db.callSession.findFirst({
      where: { id, organizationId },
      include: { participants: true },
    });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  private async requireCallById(id: string) {
    const call = await this.db.callSession.findFirst({
      where: { id },
      include: { participants: true },
    });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  private assertParticipant(call: CallSessionRow, userId: string) {
    const isCaller = call.callerId === userId;
    const isCallee = call.calleeUserId === userId;
    const isParticipant = call.participants?.some((p) => p.userId === userId);
    if (!isCaller && !isCallee && !isParticipant) {
      throw new ForbiddenException('Not a participant of this call');
    }
  }

  private assertCanAnswer(call: CallSessionRow, userId: string) {
    if (call.calleeUserId) {
      if (call.calleeUserId !== userId) {
        throw new ForbiddenException('Only the callee can answer or reject');
      }
      return;
    }
    this.assertParticipant(call, userId);
    if (call.callerId === userId) {
      throw new ForbiddenException('Caller cannot answer their own call');
    }
  }

  private peerUserIds(call: CallSessionRow, exceptUserId?: string): string[] {
    const ids = new Set<string>();
    ids.add(call.callerId);
    if (call.calleeUserId) ids.add(call.calleeUserId);
    for (const p of call.participants ?? []) {
      ids.add(p.userId);
    }
    if (exceptUserId) ids.delete(exceptUserId);
    return [...ids];
  }

  private notifyPeers(
    call: CallSessionRow,
    fromUserId: string,
    event: string,
    payload: unknown,
  ) {
    this.gateway.emitToUsers(this.peerUserIds(call, fromUserId), event, payload);
  }
}
