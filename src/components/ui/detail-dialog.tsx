import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type DetailItem = { label: string; value: ReactNode; wide?: boolean };
export type DetailSection = { title: string; items: DetailItem[] };

/** Ficha de consulta: solo lectura, mismas secciones y estilo en todas las listas del panel. */
export function DetailDialog({
  open,
  onClose,
  title,
  subtitle,
  badges,
  sections,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  sections: DetailSection[];
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          {badges && <div className="flex flex-wrap gap-1.5 pt-1">{badges}</div>}
        </DialogHeader>
        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h3 className="border-b border-white/10 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {section.items.map((item) => (
                  <div key={item.label} className={item.wide ? "sm:col-span-2" : undefined}>
                    <dt className="text-xs text-muted-foreground">{item.label}</dt>
                    <dd className="break-words text-sm text-foreground">{item.value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Controles dentro de una fila: hacer clic en ellos no debe abrir la ficha. Incluye los
// elementos de menús y diálogos, que en React burbujean hasta la fila aunque vivan en un portal.
const INTERACTIVE = "button, a, input, select, textarea, label, [role='menuitem'], [role='dialog']";

/**
 * Props para que una fila abra su ficha con clic o con Enter. Los botones dentro de la fila
 * no la abren: el Enter solo cuenta si el foco está en la fila misma.
 */
export function openRowProps(open: () => void) {
  return {
    tabIndex: 0,
    onClick: (e: MouseEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
      open();
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        open();
      }
    },
  };
}

/** Enlace externo para una ficha; null si la URL no es http(s). */
export function ExternalLink({
  href,
  children,
}: {
  href: string | undefined;
  children: ReactNode;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {children}
    </a>
  );
}
