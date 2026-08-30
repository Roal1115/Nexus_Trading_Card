import { ChevronLeft, ChevronRight } from "lucide-react";

export function TablePager({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-white/10 p-1.5 text-gray-400 transition hover:text-white disabled:opacity-30 disabled:hover:text-gray-400"
      >
        <ChevronLeft size={14} />
      </button>
      <span className="text-xs text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-md border border-white/10 p-1.5 text-gray-400 transition hover:text-white disabled:opacity-30 disabled:hover:text-gray-400"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
