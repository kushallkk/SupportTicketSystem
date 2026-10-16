import { getIO } from "@/lib/io-registry";
import { after } from "next/server";
import { getPusher } from "@/lib/pusher-server";
import { roomToChannel } from "@/lib/realtime-channels";

/**
 * Broadcast helpers. Rooms are `user:<id>` and `role:ADMIN`.
 *
 * Deployed (Pusher configured) there is no long-lived server, so events go out through Pusher's HTTP API.
 * That request must finish before the serverless function is frozen, hence `after()`. Locally the custom
 * server's Socket.io instance is used instead.
 */
function publish(rooms: string[], event: string, payload: unknown) {
  const pusher = getPusher();
  if (pusher) {
    const send = () =>
      pusher.trigger(rooms.map(roomToChannel), event, payload).catch((error) => {
        console.error("Pusher trigger failed:", error);
      });
    try {
      after(send);
    } catch {
      // Called outside a request (scripts, tests): just fire it.
      void send();
    }
    return;
  }

  const io = getIO();
  if (!io) return;
  for (const room of rooms) io.to(room).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  publish([`user:${userId}`], event, payload);
}

export function emitToAdmins(event: string, payload: unknown) {
  publish(["role:ADMIN"], event, payload);
}

export function emitTicketEvent(
  event: string,
  payload: { ticketId: string; raisedById: string; assignedToId?: string | null }
) {
  const rooms = [`user:${payload.raisedById}`, "role:ADMIN"];
  if (payload.assignedToId) rooms.push(`user:${payload.assignedToId}`);
  publish(rooms, event, payload);
}
