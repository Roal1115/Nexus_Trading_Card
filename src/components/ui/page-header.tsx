import type { ReactNode } from "react";

/** Encabezado único de página: etiqueta, título, descripción y acciones. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-3xl font-bold text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-foreground-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
