import { useEffect, useState, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { geekarena } from "@/integrations/geekarena/client";

export function useGeekarenaSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    geekarena.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      currentUserRef.current = data.session?.user?.id ?? null;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = geekarena.auth.onAuthStateChange((_e, s) => {
      const newUserId = s?.user?.id ?? null;

      // Bloqueo total si es el mismo usuario por cambio de pestaña
      if (currentUserRef.current === newUserId) {
        return;
      }

      currentUserRef.current = newUserId;
      setSession(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
