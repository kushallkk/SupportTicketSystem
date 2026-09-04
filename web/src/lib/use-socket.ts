"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

let sharedSocket: Socket | null = null;

function getSocket() {
  if (!sharedSocket) {
    sharedSocket = io({ path: "/api/socket" });
  }
  return sharedSocket;
}

/** Joins the given rooms for this client and runs `onEvent` for the named events while mounted. */
export function useRealtime(rooms: string[], handlers: Record<string, (payload: unknown) => void>) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = getSocket();
    rooms.forEach((room) => socket.emit("join", room));

    const wrapped: Record<string, (payload: unknown) => void> = {};
    for (const event of Object.keys(handlersRef.current)) {
      wrapped[event] = (payload: unknown) => handlersRef.current[event]?.(payload);
      socket.on(event, wrapped[event]);
    }

    return () => {
      for (const event of Object.keys(wrapped)) socket.off(event, wrapped[event]);
      rooms.forEach((room) => socket.emit("leave", room));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms.join(",")]);
}
