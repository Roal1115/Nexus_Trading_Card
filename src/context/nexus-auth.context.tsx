import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { nexus } from "@/integrations/nexus/client";

export type AppRole = "player" | "organizer" | "tcg_manager" | "admin";

type PlayerRow = {
  id: string;
  geek_tag: string;
  email: string | null;
  role: AppRole;
  home_store_id: string | null;
};

type AuthContextValue = {
  session: Session | null;
  player: PlayerRow | null;
  role: AppRole | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  player: null,
  role: null,
  loading: true,
});

export function NexusAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const hasInitializedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const loadPlayer = async (s: Session | null) => {
      if (!s?.user?.email) {
        if (mountedRef.current) {
          setPlayer(null);
          setSession(null);
          setLoading(false);
          hasInitializedRef.current = true;
        }
        return;
      }

      const { data } = await nexus
        .from("players")
        .select("id, geek_tag, email, role, home_store_id")
        .eq("email", s.user.email)
        .maybeSingle();

      if (!mountedRef.current) return;

      setPlayer((prev) => {
        if (prev?.id === data?.id && prev?.role === data?.role) return prev;
        return (data as PlayerRow | null) ?? null;
      });
      setSession(s);
      setLoading(false);
      hasInitializedRef.current = true;
    };

    nexus.auth.getSession().then(({ data }) => {
      if (!mountedRef.current) return;
      loadPlayer(data.session);
    });

    const { data: sub } = nexus.auth.onAuthStateChange((event, s) => {
      if (!mountedRef.current) return;
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED"
      ) {
        loadPlayer(s);
      }
    });

    return () => {
      mountedRef.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, player, role: player?.role ?? null, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useNexusRole() {
  return useContext(AuthContext);
}

export function homeRouteForRole(role: AppRole | null): string {
  if (role === "admin") return "/admin";
  if (role === "tcg_manager") return "/tcg-manager";
  if (role === "organizer") return "/organizer";
  return "/dashboard";
}
