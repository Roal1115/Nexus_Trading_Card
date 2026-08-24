import { createContext, useContext, useEffect, useState } from "react";

export type TCG = {
  id: string;
  name: string;
  slug: string;
};

type TCGContextValue = {
  activeTcg: TCG | null;
  setActiveTcg: (t: TCG | null) => void;
  tcgs: TCG[];
  setTcgs: (t: TCG[]) => void;
};

const TCGContext = createContext<TCGContextValue>({
  activeTcg: null,
  setActiveTcg: () => {},
  tcgs: [],
  setTcgs: () => {},
});

const STORAGE_KEY = "nexus.activeTcg";
// Default de producto cuando el visitante no tiene un TCG guardado: One Piece
// es el juego con actividad real. Si no está en la lista, cae al primero.
const DEFAULT_GAME_ID = "5b608762-d0a3-4a93-9739-e5cd150b01cd";

export function TCGProvider({ children }: { children: React.ReactNode }) {
  const [tcgs, setTcgsState] = useState<TCG[]>([]);
  const [activeTcg, setActiveTcgState] = useState<TCG | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setActiveTcgState(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const setActiveTcg = (t: TCG | null) => {
    setActiveTcgState(t);
    if (typeof window !== "undefined") {
      try {
        if (t) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
        else window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  };

  const setTcgs = (list: TCG[]) => {
    setTcgsState(list);
    setActiveTcgState((prev) => {
      if (prev && list.some((x) => x.id === prev.id)) return prev;
      const next = list.find((x) => x.id === DEFAULT_GAME_ID) ?? list[0] ?? null;
      if (next && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  return (
    <TCGContext.Provider value={{ activeTcg, setActiveTcg, tcgs, setTcgs }}>
      {children}
    </TCGContext.Provider>
  );
}

export function useTCG() {
  return useContext(TCGContext);
}
