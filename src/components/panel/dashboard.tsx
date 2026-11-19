// Piezas compartidas de los Inicio de panel (admin, TCG manager): secciones
// con estados de carga/error. Helpers de formato en dashboard-format.ts.
import { AlertTriangle, Loader2 } from "lucide-react";

// ---------- Piezas ----------
export function Panel({
  id,
  title,
  count,
  footer,
  children,
  busy,
}: {
  id: string;
  title: string;
  count?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
  busy?: boolean;
}) {
  return (
    <section
      aria-labelledby={id}
      aria-busy={busy}
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <h2
        id={id}
        className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm font-semibold text-foreground"
      >
        {title}
        {!!count && (
          <span className="font-mono-stat rounded-md bg-primary px-1.5 text-xs font-bold text-primary-foreground">
            {count}
          </span>
        )}
      </h2>
      <div>{children}</div>
      {footer && <div className="border-t border-border px-5 py-3 text-sm">{footer}</div>}
    </section>
  );
}

export function Loading({ className = "px-5 py-6" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm text-foreground-subtle ${className}`}>
      <Loader2 size={14} className="animate-spin" aria-hidden /> Cargando…
    </div>
  );
}

export function LoadError({
  message,
  onRetry,
  className = "px-5 py-4",
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-3 text-sm text-foreground-secondary ${className}`}
    >
      <AlertTriangle size={14} className="text-danger" aria-hidden /> No se pudo cargar: {message}
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 rounded-md border border-border px-3 text-xs text-foreground hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-8"
      >
        Reintentar
      </button>
    </div>
  );
}
