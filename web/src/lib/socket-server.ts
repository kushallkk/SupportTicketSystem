import type { Server as SocketIOServer } from "socket.io";

declare global {
  var __io: SocketIOServer | undefined;
}

export function setIO(io: SocketIOServer) {
  globalThis.__io = io;
}

export function getIO(): SocketIOServer | undefined {
  return globalThis.__io;
}

// Room-based broadcast helpers — rooms are `user:<id>`, `agent:<id>`, and `role:ADMIN`.
export function emitToUser(userId: string, event: string, payload: unknown) {
  getIO()?.to(`user:${userId}`).emit(event, payload);
}

export function emitToAdmins(event: string, payload: unknown) {
  getIO()?.to("role:ADMIN").emit(event, payload);
}

export function emitTicketEvent(event: string, payload: { ticketId: string; raisedById: string; assignedToId?: string | null }) {
  const io = getIO();
  if (!io) return;
  io.to(`user:${payload.raisedById}`).emit(event, payload);
  if (payload.assignedToId) io.to(`user:${payload.assignedToId}`).emit(event, payload);
  io.to("role:ADMIN").emit(event, payload);
}
