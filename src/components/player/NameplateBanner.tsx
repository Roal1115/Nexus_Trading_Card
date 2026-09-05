import { useEffect, useRef, useState } from "react";
import { NAMEPLATE_BANNER_STYLES, DEFAULT_NAMEPLATE_BANNER } from "@/lib/nameplate-styles";
import { NameplateArtwork, NAMEPLATE_TIER_ART, DEFAULT_NAMEPLATE_ART } from "@/components/player/NameplateArtwork";

type NameplateAchievement = {
  key: string;
  name: string;
  tier: string;
  requirement_text: string;
  base_lp: number;
  reward_detail: string | null;
};

// El Nameplate equipado se muestra como un banner clickeable (no una card
// permanente de achievement en el Hero, por decisión explícita de producto):
// un click abre un popover con el detalle del achievement que lo desbloqueó
// y — si sos el dueño del perfil — la lista de tus nameplates desbloqueados
// para cambiar. Un solo patrón de interacción para "ver detalle" y "cambiar",
// en vez de un botón de quick-action separado que duplicaría la lógica.
export function NameplateBanner({
  equipped,
  isOwner,
  unlockedNameplates,
  onEquip,
}: {
  equipped: NameplateAchievement | null;
  isOwner: boolean;
  unlockedNameplates: NameplateAchievement[];
  onEquip: (key: string | null) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Nada que mostrar: visitante sin nameplate equipado, o dueño sin ningún
  // nameplate desbloqueado todavía — no llenamos el Hero con un placeholder
  // vacío para alguien que ni siquiera tiene la opción disponible.
  if (!equipped && !(isOwner && unlockedNameplates.length > 0)) return null;

  const banner = equipped
    ? (NAMEPLATE_BANNER_STYLES[equipped.tier] ?? DEFAULT_NAMEPLATE_BANNER)
    : DEFAULT_NAMEPLATE_BANNER;
  const art = equipped
    ? (NAMEPLATE_TIER_ART[equipped.tier] ?? DEFAULT_NAMEPLATE_ART)
    : DEFAULT_NAMEPLATE_ART;

  return (
    <div ref={rootRef} className="relative mt-3 inline-block">
      {equipped ? (
        // Placa coleccionable: el arte (endcaps + barra, SVG) va en una capa
        // absoluta de fondo; el texto/ícono se superponen en HTML encima —
        // nunca se hornea el nombre en el SVG (así cualquier nameplate futuro
        // reusa el mismo frame sin generar una imagen por achievement).
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls="nameplate-popover"
          className="group relative flex h-16 items-stretch transition active:scale-[0.98] sm:hover:brightness-110"
        >
          <NameplateArtwork tier={equipped.tier} />
          <div className="relative z-10 flex items-center px-5">
            <span
              className="whitespace-nowrap text-base font-black uppercase tracking-wider"
              style={{
                backgroundImage: `linear-gradient(180deg, #fff 0%, ${art.primary} 55%, #fff 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {equipped.name}
            </span>
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls="nameplate-popover"
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 transition active:scale-95 sm:hover:border-primary/40 sm:hover:text-primary"
        >
          Elegir nameplate
        </button>
      )}

      {open && (
        <div
          id="nameplate-popover"
          role="dialog"
          aria-label="Detalle del nameplate"
          className="glass absolute left-0 top-full z-20 mt-2 w-72 rounded-xl border border-white/10 p-3 shadow-xl sm:w-80"
        >
          {equipped && (
            <div className="border-b border-white/10 pb-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">
                Desbloqueado por el achievement
              </p>
              <p className={`mt-0.5 text-sm font-bold ${banner.text}`}>{equipped.name}</p>
              <p className="mt-1 text-xs text-gray-400">{equipped.requirement_text}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-300">
                  {equipped.tier}
                </span>
                <span className="text-[10px] font-semibold text-gray-500">
                  +{equipped.base_lp} LP
                </span>
              </div>
              {equipped.reward_detail && (
                <p className="mt-1.5 text-[11px] leading-snug text-primary/80">
                  {equipped.reward_detail}
                </p>
              )}
            </div>
          )}

          {isOwner && (
            <div className={equipped ? "pt-3" : ""}>
              <p className="mb-1.5 text-[10px] uppercase tracking-widest text-gray-500">
                Tus nameplates desbloqueados
              </p>
              <div className="max-h-52 space-y-1 overflow-y-auto">
                {unlockedNameplates.map((n) => {
                  const isEquipped = equipped?.key === n.key;
                  return (
                    <button
                      key={n.key}
                      onClick={() => {
                        onEquip(isEquipped ? null : n.key);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                        isEquipped
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : "border-white/10 bg-white/5 text-gray-300 sm:hover:border-white/20 sm:hover:text-white"
                      }`}
                    >
                      <span className="truncate">{n.name}</span>
                      {isEquipped && <span className="flex-shrink-0 text-[10px]">✓ Equipado</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
