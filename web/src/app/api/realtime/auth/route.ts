import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPusher } from "@/lib/pusher-server";
import { canJoinRoom, channelToRoom } from "@/lib/realtime-channels";

/**
 * Pusher calls this before letting a browser subscribe to a private channel. A user may only listen to
 * their own `user:<id>` room (and admins to `role:ADMIN`), so nobody can eavesdrop on another user's tickets.
 */
export async function POST(req: Request) {
  const pusher = getPusher();
  if (!pusher) return NextResponse.json({ error: "Realtime is not configured." }, { status: 404 });

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const socketId = form.get("socket_id");
  const channel = form.get("channel_name");
  if (typeof socketId !== "string" || typeof channel !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const room = channelToRoom(channel);
  if (!room || !canJoinRoom(room, { id: session.user.id, role: session.user.role })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(pusher.authorizeChannel(socketId, channel));
}
