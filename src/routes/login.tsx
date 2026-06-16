import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { resolveEmailByGeekTag } from "@/lib/geekarena-auth-helpers.functions";
import { geekarena } from "@/integrations/geekarena/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión — Geek Arena" }] }),
  component: LoginPage,
});

// Traduce mensajes comunes de Supabase Auth al español (MX)
function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials"))
    return "Contraseña incorrecta. Intenta de nuevo";
  if (m.includes("user not found") || m.includes("no user"))
    return "No encontramos una cuenta con ese correo";
  if (m.includes("email not confirmed"))
    return "Debes verificar tu correo antes de entrar";
  if (m.includes("invalid email"))
    return "Ingresa un correo electrónico válido";
  if (m.includes("already registered") || m.includes("user already"))
    return "Este correo ya tiene una cuenta. ¿Quieres iniciar sesión?";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos. Espera un momento e intenta de nuevo";
  if (m.includes("network") || m.includes("fetch"))
    return "Ocurrió un error. Verifica tu conexión e intenta de nuevo";
  return "Ocurrió un error. Verifica tu conexión e intenta de nuevo";
}

function LoginPage() {
  const navigate = useNavigate();
  const resolveEmail = useServerFn(resolveEmailByGeekTag);
  const [identifier, setIdentifier] = useState(""); // Geek Tag o email
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);

  const resolveLoginEmail = async (value: string): Promise<string | null> => {
    if (value.includes("@")) return value;
    const { email: resolved } = await resolveEmail({ data: { geek_tag: value } });
    return resolved;
  };

  const startCooldown = () => {
    setCooldown(true);
    setTimeout(() => setCooldown(false), 3000);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldown) return;
    setLoading(true);
    setNeedsConfirm(null);

    const resolvedEmail = await resolveLoginEmail(identifier.trim());
    if (!resolvedEmail) {
      setLoading(false);
      startCooldown();
      toast.error("No encontramos una cuenta con ese correo o Geek Tag");
      return;
    }

    const { data, error } = await geekarena.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });
    setLoading(false);
    startCooldown();

    if (error) {
      if (/not confirmed/i.test(error.message)) {
        setNeedsConfirm(resolvedEmail);
        return;
      }
      toast.error(translateAuthError(error.message));
      return;
    }
    if (!data.user?.email_confirmed_at) {
      setNeedsConfirm(resolvedEmail);
      await geekarena.auth.signOut();
      return;
    }
    const { data: playerRow } = await geekarena
      .from("players")
      .select("role")
      .eq("email", data.user?.email ?? resolvedEmail)
      .maybeSingle();
    const role = (playerRow as { role?: string } | null)?.role;

    toast.success("¡Bienvenido de vuelta a la Arena!");
    if (role === "admin") navigate({ to: "/admin" });
    else if (role === "tcg_manager") navigate({ to: "/tcg-manager" });
    else if (role === "organizer") navigate({ to: "/organizer" });
    else navigate({ to: "/dashboard" });
  };

  const resend = async () => {
    if (!needsConfirm) return;
    const { error } = await geekarena.auth.resend({ type: "signup", email: needsConfirm });
    if (error) toast.error(translateAuthError(error.message));
    else toast.success("Correo de verificación reenviado");
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldown) return;
    setLoading(true);

    const resolvedEmail = await resolveLoginEmail(identifier.trim());
    if (!resolvedEmail) {
      setLoading(false);
      startCooldown();
      toast.error("No encontramos una cuenta con ese correo o Geek Tag");
      return;
    }

    const { error } = await geekarena.auth.resetPasswordForEmail(resolvedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    startCooldown();
    if (error) toast.error(translateAuthError(error.message));
    else toast.success("Enlace enviado — revisa tu bandeja de entrada");
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-md rounded-2xl p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Geek Arena
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            {forgotMode ? "Recupera tu acceso" : "Bienvenido de vuelta"}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {forgotMode
              ? "Te enviaremos un enlace para restablecer tu contraseña."
              : "Inicia sesión para seguir tu ranking."}
          </p>
        </div>

        {needsConfirm ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-300">
              Debes verificar tu correo antes de entrar. Enviamos un enlace a{" "}
              <span className="text-white">{needsConfirm}</span>.
            </p>
            <p className="text-xs text-gray-500">¿No recibiste el correo?</p>
            <button
              onClick={resend}
              className="w-full rounded-md border border-primary/40 bg-primary/10 py-3 text-sm font-bold uppercase tracking-widest text-primary transition hover:bg-primary/20"
            >
              Reenviar verificación
            </button>
            <button
              onClick={() => setNeedsConfirm(null)}
              className="text-xs uppercase tracking-wider text-gray-500 hover:text-white"
            >
              ← Volver a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={forgotMode ? sendReset : submit} className="space-y-4">
            <Field label="Geek Tag o correo electrónico">
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                placeholder="RedLotus o jugador@geekarena.gg"
                className="input-base"
              />
            </Field>

            {!forgotMode && (
              <Field label="Contraseña">
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
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
            )}

            <button
              type="submit"
              disabled={loading || cooldown}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {forgotMode ? "Enviar enlace" : "Entrar a la Arena"}
            </button>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setForgotMode((f) => !f)}
                className="text-gray-500 transition hover:text-primary"
              >
                {forgotMode ? "← Volver" : "¿Olvidaste tu contraseña?"}
              </button>
              {!forgotMode && (
                <Link
                  to="/signup"
                  className="font-semibold text-primary hover:text-primary/80"
                >
                  ¿No tienes cuenta? Únete al Circuito →
                </Link>
              )}
            </div>
          </form>
        )}

        <Link
          to="/"
          className="mt-6 block text-center text-xs uppercase tracking-wider text-gray-600 transition hover:text-primary"
        >
          Continuar como invitado →
        </Link>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}
