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

const STORAGE_KEY = "geekarena.activeTcg";

export function TCGProvider({ children }: { children: React.ReactNode }) {
  const [tcgs, setTcgsState] = useState<TCG[]>([]);
  const [activeTcg, setActiveTcgState] = useState<TCG | null>(null);

  // Restore from localStorage
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
    // If no active TCG chosen yet, default to first
    setActiveTcgState((prev) => {
      if (prev && list.some((x) => x.id === prev.id)) return prev;
      const next = list[0] ?? null;
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
