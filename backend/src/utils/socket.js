const { Server } = require('socket.io');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin) return callback(null, true);
        const allowedOrigins = [
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:4173',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:5174',
          process.env.FRONTEND_URL,
        ].filter(Boolean);

        if (
          allowedOrigins.includes(origin) ||
          process.env.NODE_ENV !== 'production' ||
          origin.endsWith('.trycloudflare.com') ||
          origin.endsWith('.ngrok-free.app') ||
          origin.endsWith('.loca.lt')
        ) {
          return callback(null, true);
        }
        return callback(new Error('CORS not allowed for this origin'));
      },
      credentials: true,
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
  });

  global.io = io;

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      console.warn('[Socket] No token provided');
      return next(new Error('No token'));
    }
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
      socket.userId = decoded.userId || decoded.id;
      const prisma = require('../config/prisma');
      const dbUser = await prisma.user.findUnique({
        where: { id: socket.userId },
        select: { role: true, status: true },
      });
      if (!dbUser || dbUser.status !== 'ACTIVE') {
        return next(new Error('Invalid user session'));
      }
      socket.role = decoded.isGuest || decoded.role === 'GUEST' ? 'GUEST' : dbUser.role;

      const { isUserBlocked } = require('../services/admin-blocklist.service');
      const blockCheck = await isUserBlocked(socket.userId);
      if (blockCheck.isBlocked) {
        console.warn(`[Socket] Rejected connection for blocked user: ${socket.userId}`);
        return next(new Error(`Account is restricted: ${blockCheck.reason || 'Account suspended'}`));
      }

      next();
    } catch (e) {
      console.error('[Socket] Invalid token:', e.message);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    const role = socket.role;
    console.log(`[Socket] Connected: ${userId} (${role})`);

    if (userId) {
      socket.join(userId);
      socket.join(`user:${userId}`);
      socket.join(`hospital:${userId}`);

      if (role === 'HOSPITAL') {
        const prisma = require('../config/prisma');
        prisma.hospital.findUnique({ where: { userId }, select: { id: true } })
          .then((h) => {
            if (h?.id) {
              socket.join(h.id);
              socket.join(`hospital:${h.id}`);
              socket.join(`hospitalId:${h.id}`);
              console.log(`[Socket] Hospital joined room: hospital:${h.id}`);
            }
          })
          .catch(() => {});
      }
    }

    socket.on('join_user_room', (uId) => {
      if (!socket.userId) return;
      if (uId !== socket.userId && socket.role !== 'ADMIN') {
        console.warn(`[Socket] Unauthorized room join attempt blocked: ${socket.userId} tried joining ${uId}`);
        return;
      }
      socket.join(uId);
      socket.join(`user:${uId}`);
      console.log(`[Socket] Client ${socket.id} joined room ${uId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { initSocket, getIo };
