import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { AppLogger } from '../../common/logger/app-logger.service';
import { ChatService } from './chat.service';

type AuthenticatedSocket = Socket & {
  data: {
    userId?: string;
    organizationId?: string;
  };
};

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /** userId -> connected socket ids */
  private readonly online = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
    private readonly chat: ChatService,
  ) {}

  async handleConnection(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ||
        (client.handshake.query?.token as string | undefined) ||
        client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      const userId = payload.sub;
      client.data.userId = userId;

      const organizationId =
        (client.handshake.auth?.organizationId as string | undefined) ||
        (client.handshake.query?.organizationId as string | undefined);
      if (organizationId) {
        client.data.organizationId = organizationId;
        await client.join(this.orgRoom(organizationId));
      }

      await client.join(this.userRoom(userId));
      this.trackOnline(userId, client.id);
      this.emitPresence(userId, true, organizationId);
      this.logger.log(`WS connected user=${userId}`, 'ChatGateway');
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = client.data?.userId;
    if (!userId) return;

    const stillOnline = this.untrackOnline(userId, client.id);
    if (!stillOnline) {
      this.emitPresence(userId, false, client.data.organizationId);
    }
    this.logger.log(`WS disconnected user=${userId}`, 'ChatGateway');
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.online.keys());
  }

  isOnline(userId: string): boolean {
    return (this.online.get(userId)?.size ?? 0) > 0;
  }

  emitToRoom(roomId: string, event: string, payload: unknown) {
    this.server.to(this.chatRoom(roomId)).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(this.userRoom(userId)).emit(event, payload);
  }

  @SubscribeMessage('join_room')
  async joinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !body?.roomId) return { ok: false };
    try {
      const organizationId = client.data.organizationId;
      if (organizationId) {
        await this.chat.assertRoomMember(organizationId, body.roomId, userId);
      } else {
        await this.chat.assertMember(body.roomId, userId);
      }
      await client.join(this.chatRoom(body.roomId));
      return { ok: true, roomId: body.roomId };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Forbidden';
      return { ok: false, error };
    }
  }

  @SubscribeMessage('leave_room')
  async leaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string },
  ) {
    if (!body?.roomId) return { ok: false };
    await client.leave(this.chatRoom(body.roomId));
    return { ok: true, roomId: body.roomId };
  }

  @SubscribeMessage('typing')
  typing(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; isTyping: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId || !body?.roomId) return { ok: false };
    client.to(this.chatRoom(body.roomId)).emit('typing', {
      roomId: body.roomId,
      userId,
      isTyping: !!body.isTyping,
    });
    return { ok: true };
  }

  @SubscribeMessage('message_send')
  async messageSend(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; body: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !body?.roomId || !body?.body) {
      return { ok: false, error: 'roomId and body required' };
    }
    try {
      const organizationId =
        client.data.organizationId ??
        (await this.chat.getRoomOrganizationId(body.roomId));
      const message = await this.chat.sendTextMessage(
        organizationId,
        userId,
        body.roomId,
        body.body,
      );
      this.emitToRoom(body.roomId, 'message', message);
      return { ok: true, message };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to send';
      return { ok: false, error };
    }
  }

  @SubscribeMessage('message_read')
  async messageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; messageId: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !body?.roomId || !body?.messageId) {
      return { ok: false };
    }
    try {
      const organizationId =
        client.data.organizationId ??
        (await this.chat.getRoomOrganizationId(body.roomId));
      const result = await this.chat.markRead(
        organizationId,
        userId,
        body.roomId,
        body.messageId,
      );
      this.emitToRoom(body.roomId, 'message_read', {
        ...result,
        userId,
      });
      return { ok: true, ...result };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to mark read';
      return { ok: false, error };
    }
  }

  private trackOnline(userId: string, socketId: string) {
    let set = this.online.get(userId);
    if (!set) {
      set = new Set();
      this.online.set(userId, set);
    }
    set.add(socketId);
  }

  private untrackOnline(userId: string, socketId: string): boolean {
    const set = this.online.get(userId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      this.online.delete(userId);
      return false;
    }
    return true;
  }

  private emitPresence(userId: string, isOnline: boolean, organizationId?: string) {
    const payload = { userId, isOnline };
    if (organizationId) {
      this.server.to(this.orgRoom(organizationId)).emit('presence_update', payload);
    } else {
      this.server.emit('presence_update', payload);
    }
  }

  private chatRoom(roomId: string) {
    return `chat:${roomId}`;
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private orgRoom(organizationId: string) {
    return `org:${organizationId}`;
  }
}
