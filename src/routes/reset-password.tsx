import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { geekarena } from "@/integrations/geekarena/client";
import { PasswordStrength, passwordIsValid } from "@/components/ui/PasswordStrength";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Restablecer contraseña — Geek Arena" }] }),
  component: ResetPasswordPage,
});

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("should be at least") || m.includes("password should be"))
    return "La contraseña debe tener al menos 6 caracteres";
  if (m.includes("same") || m.includes("different from the old"))
    return "La nueva contraseña debe ser diferente a la anterior";
  if (m.includes("expired") || m.includes("invalid"))
    return "El enlace expiró o no es válido. Solicita uno nuevo";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos. Espera un momento e intenta de nuevo";
  return "Ocurrió un error. Intenta de nuevo";
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase establece la sesión de recuperación automáticamente al detectar
    // el token en la URL (hash o query param) cuando el cliente carga.
    geekarena.auth.getSession().then(({ data }) => {
      setValidSession(!!data.session);
      setChecking(false);
    });

    const { data: listener } = geekarena.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setValidSession(true);
        setChecking(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!passwordIsValid(password)) {
      toast.error("La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    const { error } = await geekarena.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(translateAuthError(error.message));
      return;
    }
    setDone(true);
    toast.success("Contraseña actualizada con éxito");
    setTimeout(() => navigate({ to: "/login" }), 2000);
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-md rounded-2xl p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Geek Arena
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-gray-400">
            Elige una contraseña nueva para tu cuenta.
          </p>
        </div>

        {checking ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" />
            Verificando enlace…
          </div>
        ) : !validSession ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-300">
              Este enlace expiró o no es válido. Solicita uno nuevo desde la pantalla de inicio
              de sesión.
            </p>
            <button
              onClick={() => navigate({ to: "/login" })}
              className="w-full rounded-md border border-primary/40 bg-primary/10 py-3 text-sm font-bold uppercase tracking-widest text-primary transition hover:bg-primary/20"
            >
              Volver a iniciar sesión
            </button>
          </div>
        ) : done ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-300">
              Tu contraseña fue actualizada. Redirigiendo…
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nueva contraseña">
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="input-base pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>

            <Field label="Confirmar contraseña">
              <input
                type={showPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="input-base"
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Guardar nueva contraseña
            </button>
          </form>
        )}
      </div>

      <style>{`
        .input-base {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(15,17,23,0.6);
          padding: 0.75rem 1rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.15s;
        }
        .input-base:focus {
          border-color: #E86A22;
          box-shadow: 0 0 0 3px rgba(232,106,34,0.25);
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}
