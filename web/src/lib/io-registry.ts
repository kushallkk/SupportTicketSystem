import type { Server as SocketIOServer } from "socket.io";

/**
 * Holds the Socket.io server created by the custom dev server (server.ts). Kept in its own file with no
 * Next.js imports because server.ts loads it outside Next's runtime, where `next/server` cannot be imported.
 */
declare global {
  var __io: SocketIOServer | undefined;
}

export function setIO(io: SocketIOServer) {
  globalThis.__io = io;
}

export function getIO(): SocketIOServer | undefined {
  return globalThis.__io;
}
