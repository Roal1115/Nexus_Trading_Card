import { useEffect, useMemo, useState } from "react";

/** Tamaño de página de todas las listas del panel. */
export const LIST_PAGE_SIZE = 12;

export function usePagination<T>(items: T[], pageSize = LIST_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  // Al buscar o filtrar cambia cuántos hay: se vuelve a la primera página. Por longitud y no
  // por identidad, para no resetear si quien llama crea el arreglo en cada render.
  useEffect(() => setPage(1), [items.length]);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );
  return { page: safePage, setPage, totalPages, pageItems, pageSize, total: items.length };
}
