import {
  WebSocketGateway as NestWebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@NestWebSocketGateway({
  cors: {
    origin: '*', // Allow all origins for local development
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebsocketGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinTenant')
  handleJoinTenant(
    @ConnectedSocket() client: Socket,
    @MessageBody('tenantId') tenantId: string,
  ) {
    if (!tenantId) {
      client.emit('error', 'tenantId is required to join a room.');
      return;
    }
    const room = `tenant_${tenantId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
    client.emit('joined', { room });
  }

  @SubscribeMessage('leaveTenant')
  handleLeaveTenant(
    @ConnectedSocket() client: Socket,
    @MessageBody('tenantId') tenantId: string,
  ) {
    if (!tenantId) return;
    const room = `tenant_${tenantId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room: ${room}`);
    client.emit('left', { room });
  }

  /**
   * Broadcasts a real-time event to all connected clients of a specific tenant
   */
  sendToTenant(tenantId: string, event: string, data: any) {
    const room = `tenant_${tenantId}`;
    if (this.server) {
      this.server.to(room).emit(event, data);
      this.logger.debug(`Broadcasted event "${event}" to room "${room}"`);
    } else {
      this.logger.warn('WebSocket server is not initialized yet. Skipping broadcast.');
    }
  }
}
