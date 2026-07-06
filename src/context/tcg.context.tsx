import { createContext, useContext, useEffect, useState } from "react";

type TCG = {
  id: string;
  name: string;
  slug: string;
};

type TCGContextValue = {
  activeTcg: TCG | null;
  setActiveTcg: (tcg: TCG) => void;
  tcgs: TCG[];
  setTcgs: (tcgs: TCG[]) => void;
};

const TCGContext = createContext<TCGContextValue>({
  activeTcg: null,
  setActiveTcg: () => {},
  tcgs: [],
  setTcgs: () => {},
});

export function TCGProvider({ children }: { children: React.ReactNode }) {
  const [tcgs, setTcgs] = useState<TCG[]>([]);
  const [activeTcg, setActiveTcgState] = useState<TCG | null>(null);

  const setActiveTcg = (tcg: TCG) => {
    setActiveTcgState(tcg);
    if (typeof window !== "undefined") {
      localStorage.setItem("ga_active_tcg_id", tcg.id);
    }
  };

  // Restaurar TCG activo del localStorage después del mount
  useEffect(() => {
    if (!tcgs.length) return;
    const saved = typeof window !== "undefined" ? localStorage.getItem("ga_active_tcg_id") : null;
    const found = saved ? tcgs.find((t) => t.id === saved) : null;
    setActiveTcgState(found ?? tcgs[0]);
  }, [tcgs]);

  return (
    <TCGContext.Provider value={{ activeTcg, setActiveTcg, tcgs, setTcgs }}>
      {children}
    </TCGContext.Provider>
  );
}

export function useTCG() {
  return useContext(TCGContext);
}
