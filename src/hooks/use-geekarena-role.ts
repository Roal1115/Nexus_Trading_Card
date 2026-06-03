import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { geekarena } from "@/integrations/geekarena/client";

export type AppRole = "player" | "organizer" | "tcg_manager" | "admin";

type PlayerRow = {
  id: string;
  geek_tag: string;
  email: string | null;
  role: AppRole;
  home_store_id: string | null;
};

export function useGeekarenaRole() {
  const [session, setSession] = useState<Session | null>(null);
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadPlayer = async (s: Session | null) => {
      if (!s?.user?.email) {
        if (mounted) {
          setPlayer(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await geekarena
        .from("players")
        .select("id, geek_tag, email, role, home_store_id")
        .eq("email", s.user.email)
        .maybeSingle();
      if (!mounted) return;
      setPlayer((data as PlayerRow | null) ?? null);
      setLoading(false);
    };

    geekarena.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      loadPlayer(data.session);
    });

    const { data: sub } = geekarena.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(true);
      loadPlayer(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const role: AppRole | null = player?.role ?? null;
  return { session, player, role, loading };
}

export function homeRouteForRole(role: AppRole | null): string {
  if (role === "admin") return "/admin";
  if (role === "tcg_manager") return "/tcg-manager";
  if (role === "organizer") return "/organizer";
  return "/dashboard";
}
