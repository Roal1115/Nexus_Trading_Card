import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTCG } from "@/context/tcg.context";

// Switcher de TCG activo. collapsed = versión compacta para sidebar colapsado.
export function TcgSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { activeTcg, setActiveTcg, tcgs } = useTCG();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!tcgs.length) return null;

  const initials = activeTcg?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? activeTcg?.name : undefined}
        className={`flex items-center rounded-lg border border-[#2A3A57] bg-[#111A2E] text-xs font-semibold text-white transition hover:border-[#32D9FF]/40 ${
          collapsed ? "h-9 w-9 justify-center" : "gap-1.5 px-3 py-1.5"
        }`}
      >
        {collapsed ? (
          <span className="text-[10px] text-[#32D9FF]">{initials ?? "TCG"}</span>
        ) : (
          <>
            {activeTcg?.name ?? "TCG"}
            <ChevronDown size={14} className={open ? "rotate-180 transition" : "transition"} />
          </>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-full mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#0B1220]/95 shadow-2xl backdrop-blur-xl z-50 ${
            collapsed ? "left-0" : "left-1/2 -translate-x-1/2"
          }`}
        >
          {tcgs.map((tcg) => (
            <button
              key={tcg.id}
              type="button"
              onClick={() => {
                setActiveTcg(tcg);
                setOpen(false);
              }}
              className={`flex w-full items-center px-3 py-2.5 text-left text-sm transition hover:bg-white/5 ${
                activeTcg?.id === tcg.id ? "text-[#32D9FF] font-semibold" : "text-white"
              }`}
            >
              {tcg.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
