import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import config from './env';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

let io: SocketIOServer;

export const initializeSocket = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      // #8 — use same allowlist as HTTP CORS
      origin: ALLOWED_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST']
    },
    path: '/socket.io',
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // #33 Socket auth — only accept token from auth handshake, never from headers
  // This avoids token-source confusion and is the Socket.IO-idiomatic approach
  io.use((socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, config.JWT_ACCESS_TOKEN_SECRET as string) as { userId: string; sessionId: string };
      socket.data.userId = decoded.userId;
      socket.data.sessionId = decoded.sessionId;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`User connected: ${userId}, Socket ID: ${socket.id}`);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}, Socket ID: ${socket.id}`);
      
      // Update user status to offline
      try {
        const { setUserOffline } = await import('../services/user-status.service');
        await setUserOffline(userId, 'user');
      } catch (error) {
        console.error('Error setting user offline:', error);
      }
    });

    // Handle online status update
    socket.on('user:online', async (data: { userType: 'admin' | 'instructor' | 'user' }) => {
      try {
        const { setUserOnline } = await import('../services/user-status.service');
        await setUserOnline(userId, data.userType, socket.id);
        
        // Broadcast status change to relevant users
        socket.broadcast.emit('user:status_changed', {
          userId,
          userType: data.userType,
          isOnline: true
        });
      } catch (error) {
        console.error('Error setting user online:', error);
      }
    });

    // Handle notification acknowledgment
    socket.on('notification:ack', async (data: { notificationId: string }) => {
      try {
        const { markNotificationAsRead } = await import('../services/notification.service');
        await markNotificationAsRead(data.notificationId, userId);
        
        // Emit updated unread count
        const { getUnreadNotificationsCount } = await import('../services/notification.service');
        const count = await getUnreadNotificationsCount(userId, 'user');
        socket.emit('notification:unread_count', { count });
      } catch (error) {
        console.error('Error acknowledging notification:', error);
      }
    });

    // Handle typing indicators (optional future feature)
    socket.on('typing:start', (data: { recipientId: string }) => {
      socket.to(`user:${data.recipientId}`).emit('typing:start', { userId });
    });

    socket.on('typing:stop', (data: { recipientId: string }) => {
      socket.to(`user:${data.recipientId}`).emit('typing:stop', { userId });
    });
  });

  console.log('Socket.io server initialized');
  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket first.');
  }
  return io;
};

export const emitToUser = (userId: string, event: string, data: any): void => {
  const ioInstance = getIO();
  ioInstance.to(`user:${userId}`).emit(event, data);
};

export const emitToUserType = (userType: 'admin' | 'instructor' | 'user', event: string, data: any): void => {
  const ioInstance = getIO();
  ioInstance.to(`user_type:${userType}`).emit(event, data);
};

export const broadcastToAll = (event: string, data: any): void => {
  const ioInstance = getIO();
  ioInstance.emit(event, data);
};
