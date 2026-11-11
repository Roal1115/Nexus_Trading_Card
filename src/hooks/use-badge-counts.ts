import { useState, useEffect, useCallback, useRef } from "react";

const ACTIVITY_LAST_SEEN_KEY = "geek_arena_activity_last_seen";

export function useActivityLastSeen() {
  const get = () =>
    typeof window !== "undefined"
      ? (localStorage.getItem(ACTIVITY_LAST_SEEN_KEY) ?? undefined)
      : undefined;
  const markSeen = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVITY_LAST_SEEN_KEY, new Date().toISOString());
    }
  };
  return { get, markSeen };
}

export function useBadgeCounts<T extends Record<string, number>>(
  fetchFn: (args: { data: any }) => Promise<T>,
  getArgs?: () => any,
  refreshMs = 60_000,
) {
  const [counts, setCounts] = useState<T | null>(null);
  const argsRef = useRef(getArgs);
  argsRef.current = getArgs;

  const load = useCallback(async () => {
    try {
      const args = argsRef.current ? argsRef.current() : {};
      const data = await fetchFn({ data: args });
      setCounts(data);
    } catch (e) {
      console.error("badge count error:", e);
    }
  }, [fetchFn]);

  useEffect(() => {
    load();
    const interval = setInterval(load, refreshMs);
    window.addEventListener(BADGES_CHANGED, load);
    return () => {
      clearInterval(interval);
      window.removeEventListener(BADGES_CHANGED, load);
    };
  }, [load, refreshMs]);

  return { counts, reload: load };
}

const BADGES_CHANGED = "nexus:badges-changed";

/**
 * Pide al sidebar que vuelva a contar ya, sin esperar el siguiente minuto. Para pantallas
 * que resuelven algo que el badge cuenta (aprobar una tienda, revisar un torneo...).
 */
export function refreshBadges() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(BADGES_CHANGED));
}
