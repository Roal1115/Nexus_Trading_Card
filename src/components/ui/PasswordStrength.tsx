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
  const barColor =
    passed <= 1
      ? "bg-red-500"
      : passed <= 3
      ? "bg-amber-400"
      : passed === 4
      ? "bg-blue-400"
      : "bg-emerald-400";

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                i <= passed ? barColor : "bg-white/10"
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-gray-400">{strength}</span>
      </div>
      <ul className="space-y-1">
        {rules.map((req) => (
          <li key={req.label} className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold ${
                req.ok ? "text-emerald-400" : "text-gray-600"
              }`}
            >
              {req.ok ? "✓" : "○"}
            </span>
            <span
              className={`text-[10px] ${req.ok ? "text-emerald-400" : "text-gray-500"}`}
            >
              {req.label}
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
