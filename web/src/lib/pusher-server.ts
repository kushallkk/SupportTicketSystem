import Pusher from "pusher";

let client: Pusher | null | undefined;

/** The Pusher server client, or null when Pusher isn't configured (local dev uses Socket.io instead). */
export function getPusher(): Pusher | null {
  if (client !== undefined) return client;
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;
  client =
    PUSHER_APP_ID && PUSHER_KEY && PUSHER_SECRET && PUSHER_CLUSTER
      ? new Pusher({ appId: PUSHER_APP_ID, key: PUSHER_KEY, secret: PUSHER_SECRET, cluster: PUSHER_CLUSTER, useTLS: true })
      : null;
  return client;
}
