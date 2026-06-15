import { useEffect, useState, useRef } from "react";
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

  // 🛡️ EL GUARDIÁN: Recuerda qué usuario está activo sin provocar re-renders
  const currentUserRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadPlayer = async (s: Session | null, showLoading: boolean) => {
      if (!s?.user?.email) {
        if (mounted) {
          setPlayer(null);
          if (showLoading) setLoading(false);
        }
        return;
      }

      if (showLoading) setLoading(true);

      const { data } = await geekarena
        .from("players")
        .select("id, geek_tag, email, role, home_store_id")
        .eq("email", s.user.email)
        .maybeSingle();

      if (!mounted) return;

      setPlayer((prev) => {
        // 🛡️ SEGUNDA BARRERA: Si los datos de la BD son idénticos a los que ya teníamos, anulamos el re-render
        if (prev?.id === data?.id && prev?.role === data?.role) return prev;
        return (data as PlayerRow | null) ?? null;
      });

      if (showLoading) setLoading(false);
    };

    geekarena.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      currentUserRef.current = data.session?.user?.id ?? null;
      setSession(data.session);
      loadPlayer(data.session, true);
    });

    const { data: sub } = geekarena.auth.onAuthStateChange((event, s) => {
      const newUserId = s?.user?.id ?? null;

      // 🔥 AQUÍ MATAMOS EL PROBLEMA DE LAS PESTAÑAS:
      // Si el evento nos trae al MISMO usuario que ya tenemos registrado...
      if (currentUserRef.current === newUserId) {
        // ...Ignoramos el evento. No tocamos `setSession`, no tocamos `setLoading`. Nada.
        return;
      }

      // Si llegamos aquí, es porque fue un Log In o Log Out real
      currentUserRef.current = newUserId;
      setSession(s);

      const isSignInOrOut = event === "SIGNED_IN" || event === "SIGNED_OUT";
      loadPlayer(s, isSignInOrOut);
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
