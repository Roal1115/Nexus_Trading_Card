import { Check, Circle } from "lucide-react";

export function PasswordStrength({ password }: { password: string }) {
  if (password.length === 0) return null;

  const rules = [
    { label: "Mínimo 8 caracteres", ok: password.length >= 8 },
    { label: "Al menos una mayúscula", ok: /[A-Z]/.test(password) },
    { label: "Al menos una minúscula", ok: /[a-z]/.test(password) },
    { label: "Al menos un número", ok: /[0-9]/.test(password) },
    {
      label: "Al menos un carácter especial (!@#$%^&*)",
      ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    },
  ];

  const passed = rules.filter((r) => r.ok).length;
  const strength =
    passed <= 1 ? "débil" : passed <= 3 ? "regular" : passed === 4 ? "buena" : "fuerte";
  // Validación, no resultado de partida: rojo → amarillo → verde con los tokens del sistema.
  const barColor = passed <= 1 ? "bg-danger" : passed <= 3 ? "bg-warning" : "bg-success";

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                i <= passed ? barColor : "bg-secondary"
              }`}
            />
          ))}
        </div>
        <span aria-live="polite" className="text-xs text-foreground-secondary">
          Seguridad: {strength}
        </span>
      </div>
      <ul className="space-y-1">
        {rules.map((req) => (
          <li
            key={req.label}
            className={`flex items-center gap-2 text-xs ${
              req.ok ? "text-foreground-secondary" : "text-foreground-subtle"
            }`}
          >
            {req.ok ? (
              <Check size={14} aria-hidden="true" className="text-success" />
            ) : (
              <Circle size={14} aria-hidden="true" />
            )}
            <span>
              {req.label}
              <span className="sr-only">{req.ok ? ": cumplido" : ": pendiente"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function passwordIsValid(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
