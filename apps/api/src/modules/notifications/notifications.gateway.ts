import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { AppLogger } from '../../common/logger/app-logger.service';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
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
      this.logger.log(`WS connected user=${userId}`, 'NotificationsGateway');
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId as string | undefined;
    if (userId) {
      this.logger.log(`WS disconnected user=${userId}`, 'NotificationsGateway');
    }
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(this.room(userId)).emit(event, payload);
  }

  private room(userId: string) {
    return `user:${userId}`;
  }
}
