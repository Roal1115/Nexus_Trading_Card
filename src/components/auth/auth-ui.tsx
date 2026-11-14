import type { InputHTMLAttributes, ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FOCUS_RING, INPUT, LABEL } from "@/components/stores/store-ui";

/**
 * Marco de las pantallas de acceso (entrar, registro, revisar correo, nueva contraseña):
 * marca, título y una sola superficie plana. Sin glass, sin kicker en mayúsculas.
 */
export function AuthShell({
  title,
  description,
  wide,
  children,
  footer,
}: {
  title: ReactNode;
  description?: ReactNode;
  wide?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-start justify-center px-4 py-8 sm:items-center sm:py-12">
      <div className={`w-full ${wide ? "max-w-xl" : "max-w-md"}`}>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {description && <p className="mt-2 text-foreground-secondary">{description}</p>}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">{children}</div>
        {footer && <div className="mt-5 text-center text-sm">{footer}</div>}
      </div>
    </main>
  );
}

/** Campo con label, y debajo un error (rojo, anunciado) o una ayuda (tenue) con id `${id}-msg`. */
export function Field({
  id,
  label,
  hint,
  error,
  aside,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Estado a la derecha del label (p. ej. "Disponible"). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-xs text-foreground-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** id, aria-invalid y aria-describedby de un input dentro de `Field`. */
export const fieldProps = (id: string, opts: { error?: string; hint?: unknown } = {}) => ({
  id,
  "aria-invalid": opts.error ? true : undefined,
  "aria-describedby": opts.error || opts.hint ? `${id}-msg` : undefined,
});

export const authInput = (error?: string) => `${INPUT} ${error ? "border-destructive" : ""}`;

/** Contraseña con botón de mostrar/ocultar de 44px. */
export function PasswordInput({
  show,
  onToggle,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  show: boolean;
  onToggle: () => void;
  error?: string;
}) {
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={`${authInput(error)} pr-11`} />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={show}
        className={`absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-md text-foreground-subtle transition hover:text-foreground sm:h-9 ${FOCUS_RING}`}
      >
        {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}

/** Error del envío, en línea y anunciado; un toast desaparece antes de que se lea. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  );
}

/** Enlace de texto secundario (Volver, Iniciar sesión…). */
export const TEXT_LINK = `inline-flex min-h-11 items-center rounded-md text-sm font-medium text-foreground-secondary underline-offset-4 transition hover:text-foreground hover:underline sm:min-h-9 ${FOCUS_RING}`;
