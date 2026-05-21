import { io, Socket } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

/**
 * Singleton socket instance.
 * Initialized with autoConnect: false to prevent immediate connection.
 * Uses websocket transport only for stability.
 */
export const socket: Socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ["websocket"],
  withCredentials: true,
});

// Debug logs for connection state
socket.on("connect", () => {
  console.log("[WS] Connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("[WS] Disconnected. Reason:", reason);
});

socket.on("connect_error", (error) => {
  console.error("[WS] Connection Error:", error.message);
});
