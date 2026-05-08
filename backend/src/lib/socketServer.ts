import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";

let io: SocketIOServer | null = null;

/**
 * Initialize and return the Socket.IO server bound to the given HTTP server.
 * Must be called once during app startup before any routes try to emit events.
 */
export function initSocketServer(httpServer: HttpServer, frontendUrl: string): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: frontendUrl,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // Each authenticated user joins their own private room: "user:<entra_oid>"
    const oid = socket.handshake.auth?.oid as string | undefined;
    if (oid) {
      socket.join(`user:${oid}`);
      console.log(`[WS] User ${oid} connected (socket ${socket.id})`);
    }

    // Allow identification after connection (for singleton socket)
    socket.on("authenticate", (newOid: string) => {
      if (newOid) {
        socket.join(`user:${newOid}`);
        console.log(`[WS] User ${newOid} authenticated (socket ${socket.id})`);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[WS] Socket ${socket.id} disconnected. Reason: ${reason}`);
    });
  });

  return io;
}

/** Get the current Socket.IO server instance (null if not yet initialized) */
export function getSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Emit a new notification to a specific user room.
 * Safe to call from any route — does nothing if socket server not up.
 */
export function emitNotification(recipientOid: string, notification: object): void {
  if (!io) return;
  io.to(`user:${recipientOid}`).emit("notification", notification);
}
