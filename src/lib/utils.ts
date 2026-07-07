import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// "YYYY-MM-DD" usando los campos LOCALES de la fecha — nunca usar
// toISOString() para esto: convierte a UTC y puede desplazar el día.
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "Hoy" en zona horaria de México ("YYYY-MM-DD"), sin importar dónde
// corra el proceso (el server en Cloudflare corre en UTC — a las 6pm MX
// el "hoy" UTC ya es mañana).
export function todayInMexicoStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}
