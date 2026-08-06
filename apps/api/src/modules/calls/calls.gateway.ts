import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { AppLogger } from '../../common/logger/app-logger.service';
import { CallsService } from './calls.service';
import {
  CallIdDto,
  ScreenShareStateDto,
  WebrtcSignalDto,
} from './dto/calls.dto';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/calls',
})
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
    @Inject(forwardRef(() => CallsService))
    private readonly calls: CallsService,
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
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
      await client.join(this.room(userId));
      this.logger.log(`WS connected user=${userId}`, 'CallsGateway');
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId as string | undefined;
    if (userId) {
      this.logger.log(`WS disconnected user=${userId}`, 'CallsGateway');
    }
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(this.room(userId)).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown) {
    for (const userId of userIds) {
      this.emitToUser(userId, event, payload);
    }
  }

  @SubscribeMessage('call_accept')
  async onCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: CallIdDto,
  ) {
    const userId = client.data?.userId as string | undefined;
    if (!userId || !body?.callId) return;
    return this.calls.answerByUser(userId, body.callId);
  }

  @SubscribeMessage('call_reject')
  async onCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: CallIdDto,
  ) {
    const userId = client.data?.userId as string | undefined;
    if (!userId || !body?.callId) return;
    return this.calls.rejectByUser(userId, body.callId);
  }

  @SubscribeMessage('call_end')
  async onCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: CallIdDto,
  ) {
    const userId = client.data?.userId as string | undefined;
    if (!userId || !body?.callId) return;
    return this.calls.endByUser(userId, body.callId);
  }

  @SubscribeMessage('webrtc_offer')
  onOffer(@ConnectedSocket() client: Socket, @MessageBody() body: WebrtcSignalDto) {
    const fromUserId = client.data?.userId as string | undefined;
    if (!fromUserId || !body?.toUserId || !body?.callId) return;
    this.emitToUser(body.toUserId, 'webrtc_offer', {
      callId: body.callId,
      sdp: body.sdp,
      fromUserId,
      toUserId: body.toUserId,
    });
  }

  @SubscribeMessage('webrtc_answer')
  onAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: WebrtcSignalDto) {
    const fromUserId = client.data?.userId as string | undefined;
    if (!fromUserId || !body?.toUserId || !body?.callId) return;
    this.emitToUser(body.toUserId, 'webrtc_answer', {
      callId: body.callId,
      sdp: body.sdp,
      fromUserId,
      toUserId: body.toUserId,
    });
  }

  @SubscribeMessage('webrtc_ice')
  onIce(@ConnectedSocket() client: Socket, @MessageBody() body: WebrtcSignalDto) {
    const fromUserId = client.data?.userId as string | undefined;
    if (!fromUserId || !body?.toUserId || !body?.callId) return;
    this.emitToUser(body.toUserId, 'webrtc_ice', {
      callId: body.callId,
      candidate: body.candidate,
      fromUserId,
      toUserId: body.toUserId,
    });
  }

  @SubscribeMessage('screen_share_state')
  async onScreenShareState(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ScreenShareStateDto,
  ) {
    const userId = client.data?.userId as string | undefined;
    if (!userId || !body?.callId || typeof body.enabled !== 'boolean') return;
    const call = await this.calls.setScreenShareByUser(userId, body.callId, body.enabled);
    if (body.toUserId) {
      this.emitToUser(body.toUserId, 'screen_share_state', {
        callId: body.callId,
        enabled: body.enabled,
        fromUserId: userId,
      });
    }
    return call;
  }

  private room(userId: string) {
    return `user:${userId}`;
  }
}
