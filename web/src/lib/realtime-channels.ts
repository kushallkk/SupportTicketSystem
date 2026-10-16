/**
 * Rooms are named `user:<id>` and `role:ADMIN` throughout the app. Pusher only accepts a restricted
 * character set and needs the `private-` prefix to require authorization, so map between the two.
 */
export function roomToChannel(room: string): string {
  return `private-${room.replace(":", "-")}`;
}

/** Inverse of roomToChannel, or null if this isn't one of our channels. */
export function channelToRoom(channel: string): string | null {
  const match = /^private-(user|role)-(.+)$/.exec(channel);
  return match ? `${match[1]}:${match[2]}` : null;
}

/** Whether a signed-in user may listen to a room: their own, or the admin room if they are an admin. */
export function canJoinRoom(room: string, user: { id: string; role: string }): boolean {
  if (room === "role:ADMIN") return user.role === "ADMIN";
  return room === `user:${user.id}`;
}
