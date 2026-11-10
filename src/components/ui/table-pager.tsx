import { ChevronLeft, ChevronRight } from "lucide-react";

/** Pie de las listas del panel: rango a la izquierda, flechas a la derecha. */
export function TablePager({
  page,
  totalPages,
  onPageChange,
  total,
  pageSize,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  pageSize?: number;
}) {
  const showRange = total !== undefined && pageSize !== undefined && total > 0;
  if (totalPages <= 1 && !showRange) return null;
  const from = showRange ? (page - 1) * pageSize + 1 : 0;
  const to = showRange ? Math.min(page * pageSize, total) : 0;

  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">
        {showRange && `Mostrando ${from}–${to} de ${total}`}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-md border border-white/10 p-1.5 text-gray-400 transition hover:text-white disabled:opacity-30 disabled:hover:text-gray-400"
            aria-label="Página anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-md border border-white/10 p-1.5 text-gray-400 transition hover:text-white disabled:opacity-30 disabled:hover:text-gray-400"
            aria-label="Página siguiente"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
