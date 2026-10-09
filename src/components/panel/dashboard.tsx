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
    <section aria-labelledby={id} aria-busy={busy} className="glass overflow-hidden rounded-2xl">
      <h2
        id={id}
        className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-sm font-semibold text-white"
      >
        {title}
        {!!count && (
          <span className="rounded-full bg-primary/20 px-2 text-xs font-bold text-primary">
            {count}
          </span>
        )}
      </h2>
      <div>{children}</div>
      {footer && <div className="border-t border-white/10 px-5 py-3 text-sm">{footer}</div>}
    </section>
  );
}

export function Loading({ className = "px-5 py-6" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm text-gray-400 ${className}`}>
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
      className={`flex flex-wrap items-center gap-3 text-sm text-red-200 ${className}`}
    >
      <AlertTriangle size={14} aria-hidden /> No se pudo cargar: {message}
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-white/15 px-2 py-1 text-xs text-white hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Reintentar
      </button>
    </div>
  );
}
