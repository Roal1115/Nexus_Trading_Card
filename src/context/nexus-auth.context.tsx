import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  // true en cuanto sabemos si existe sesión (no espera el fetch de la fila
  // player, que es la parte lenta/de red). Permite al shell (sidebar/header/
  // bottom nav) decidir su forma final sin esperar ese round-trip.
  authResolved: boolean;
  // Mejor estimación de "hay usuario logueado" disponible en el primer
  // render del cliente: antes de que authResolved sea true usa una lectura
  // síncrona de localStorage; después usa el estado de sesión real.
  probablyAuthed: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  player: null,
  role: null,
  loading: true,
  authResolved: false,
  probablyAuthed: false,
});

// Supabase persiste la sesión en localStorage bajo storageKey "nexus.auth"
// (ver integrations/nexus/client.ts). Leerla directo evita esperar el
// round-trip de getSession()/fetch del perfil solo para saber "hay sesión".
function readStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem("nexus.auth");
  } catch {
    return false;
  }
}

// useLayoutEffect no corre en SSR (evita el warning de React) y en cliente
// se ejecuta antes del paint: la lectura de localStorage puede actualizar
// el estado sin que el usuario vea el frame "sin sesión" intermedio.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function NexusAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [authResolved, setAuthResolved] = useState(false);
  // Arranca en false para que el primer render del cliente coincida con el
  // HTML del servidor (que no conoce localStorage) y no dispare un
  // hydration mismatch; se corrige en el layout effect de abajo, antes del
  // primer paint del cliente.
  const [storedGuess, setStoredGuess] = useState(false);
  const hasInitializedRef = useRef(false);
  const mountedRef = useRef(true);

  useIsomorphicLayoutEffect(() => {
    setStoredGuess(readStoredSession());
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const loadPlayer = async (s: Session | null) => {
      if (mountedRef.current) {
        setSession(s);
        setAuthResolved(true);
      }

      if (!s?.user?.email) {
        if (mountedRef.current) {
          setPlayer(null);
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

  const probablyAuthed = authResolved ? !!session : storedGuess;

  const value = useMemo<AuthContextValue>(
    () => ({ session, player, role: player?.role ?? null, loading, authResolved, probablyAuthed }),
    [session, player, loading, authResolved, probablyAuthed],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
