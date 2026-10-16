"use client";

import { useSyncExternalStore } from "react";

/** SSR-safe media query: false on the server and during hydration, then tracks the real value. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
