"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import Pusher from "pusher-js";
import { roomToChannel } from "@/lib/realtime-channels";

type Handler = (payload: unknown) => void;

/**
 * Realtime has two transports behind one hook:
 *  - Pusher when NEXT_PUBLIC_PUSHER_KEY is set (the deployed app: serverless hosts can't hold sockets open)
 *  - Socket.io against the custom dev server otherwise
 */
const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

let sharedSocket: Socket | null = null;
function getSocket() {
  if (!sharedSocket) sharedSocket = io({ path: "/api/socket" });
  return sharedSocket;
}

let sharedPusher: Pusher | null = null;
function getPusherClient(key: string) {
  if (!sharedPusher) {
    sharedPusher = new Pusher(key, {
      cluster: PUSHER_CLUSTER ?? "mt1",
      channelAuthorization: { endpoint: "/api/realtime/auth", transport: "ajax" },
    });
  }
  return sharedPusher;
}

/** Joins the given rooms for this client and runs `onEvent` for the named events while mounted. */
export function useRealtime(rooms: string[], handlers: Record<string, Handler>) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const events = Object.keys(handlersRef.current);
    const wrapped: Record<string, Handler> = {};
    for (const event of events) wrapped[event] = (payload) => handlersRef.current[event]?.(payload);

    if (PUSHER_KEY) {
      const pusher = getPusherClient(PUSHER_KEY);
      const channels = rooms.map((room) => pusher.subscribe(roomToChannel(room)));
      for (const channel of channels) for (const event of events) channel.bind(event, wrapped[event]);
      return () => {
        // Unbind only our handlers. The channel stays subscribed: other mounted components may share it.
        for (const channel of channels) for (const event of events) channel.unbind(event, wrapped[event]);
      };
    }

    const socket = getSocket();
    rooms.forEach((room) => socket.emit("join", room));
    for (const event of events) socket.on(event, wrapped[event]);
    return () => {
      for (const event of events) socket.off(event, wrapped[event]);
      rooms.forEach((room) => socket.emit("leave", room));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms.join(",")]);
}
