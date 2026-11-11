import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** "+N más" de una celda del calendario: abre la lista completa de ese horario. */
export function MoreEntriesPopover({
  hiddenCount,
  title,
  children,
}: {
  hiddenCount: number;
  title: string;
  /** Recibe `close` para cerrar el panel al elegir un torneo. */
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ver ${hiddenCount} torneos más: ${title}`}
          className="min-h-6 w-full rounded px-1 text-left text-xs font-medium text-foreground-secondary transition hover:bg-white/5 hover:text-foreground"
        >
          +{hiddenCount} más
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <p className="mb-2 px-1 text-xs font-semibold text-foreground-secondary">{title}</p>
        <div className="max-h-72 space-y-1 overflow-y-auto">{children(() => setOpen(false))}</div>
      </PopoverContent>
    </Popover>
  );
}
