import { useEffect, useRef, type ReactNode } from "react";

/** Superficie única de la ficha de tienda: card plano con borde de 1px, sin glass ni sombra. */
export const SECTION = "rounded-xl border border-border bg-card p-4 @2xl:p-6";

export const BTN_OUTLINE =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground-secondary transition hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9";

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Grupo de filtro de una sola opción activa. Hace scroll horizontal en móvil y, para que un
 * enlace compartido no llegue con el filtro activo fuera de pantalla, lleva el chip activo al
 * centro cuando cambia (`block: "nearest"` para no mover la página en vertical).
 */
export function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ key: string | null; label: string }>;
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [value]);
  return (
    <div ref={ref} role="group" aria-label={label} className="flex gap-2 overflow-x-auto pb-1">
      {options.map((o) => (
        <button
          key={o.key ?? "all"}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={`min-h-11 flex-shrink-0 cursor-pointer whitespace-nowrap rounded-md border px-3 text-sm font-medium transition ${FOCUS_RING} sm:min-h-9 ${
            value === o.key
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border text-foreground-secondary hover:bg-white/5 hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Error de una consulta, con salida. Evita que un fallo de red se lea como "no hay datos":
 * el vacío real se reserva para respuestas exitosas sin filas.
 */
export function InlineError({ children, onRetry }: { children: ReactNode; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
      <p className="text-destructive">{children}</p>
      <button type="button" onClick={onRetry} className={BTN_OUTLINE}>
        Reintentar
      </button>
    </div>
  );
}
