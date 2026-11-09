import type { ReactNode } from "react";

/** Estado vacío: dice qué pasa y, si se puede, qué hacer. El contenedor lo pone la pantalla. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icon && (
        <span className="mb-1 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </span>
      )}
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-foreground-secondary">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
