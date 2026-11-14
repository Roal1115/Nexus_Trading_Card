import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  loginWithIdentifier,
  resendConfirmation,
  sendPasswordReset,
} from "@/lib/nexus-auth-helpers.functions";
import { nexus } from "@/integrations/nexus/client";
import { homeRouteForRole, useNexusRole } from "@/hooks/use-nexus-role";
import { BTN_OUTLINE, BTN_PRIMARY } from "@/components/stores/store-ui";
import {
  AuthShell,
  Field,
  FormError,
  PasswordInput,
  TEXT_LINK,
  authInput,
  fieldProps,
} from "@/components/auth/auth-ui";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión — Nexus" }] }),
  component: LoginPage,
});

// Traduce mensajes comunes de Supabase Auth al español (MX)
function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials"))
    return "Contraseña incorrecta. Intenta de nuevo";
  if (m.includes("user not found") || m.includes("no user"))
    return "No encontramos una cuenta con ese correo";
  if (m.includes("email not confirmed")) return "Debes verificar tu correo antes de entrar";
  if (m.includes("banned"))
    return "Tu cuenta aún no está activa. Si registraste una tienda, sigue en revisión.";
  if (m.includes("invalid email")) return "Ingresa un correo electrónico válido";
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
  const { authResolved, session, role, loading: roleLoading } = useNexusRole();
  const doLogin = useServerFn(loginWithIdentifier);
  const doResend = useServerFn(resendConfirmation);
  const doReset = useServerFn(sendPasswordReset);
  const [identifier, setIdentifier] = useState(""); // Nexus Tag o email
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  // Email enmascarado (j*****@gmail.com) — el email real nunca llega al cliente
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  // Error del último envío, en línea junto al formulario.
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // Ya hay sesión (llegó por bookmark/refresh a /login): sácalo a su panel
  // en vez de mostrarle el formulario de nuevo.
  useEffect(() => {
    // Esperar también `!roleLoading`: authResolved solo indica que ya
    // sabemos si hay sesión, pero `role` se resuelve después con el fetch
    // de `player` — redirigir antes de eso mandaba a admins/organizadores
    // a /dashboard porque role todavía era null.
    if (authResolved && session && !roleLoading) {
      navigate({ to: homeRouteForRole(role), replace: true });
    }
  }, [authResolved, session, roleLoading, role, navigate]);

  const startCooldown = () => {
    setCooldown(true);
    setTimeout(() => setCooldown(false), 3000);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldown) return;
    setLoading(true);
    setNeedsConfirm(null);
    setFormError(null);

    const res: any = await doLogin({
      data: { identifier: identifier.trim(), password },
    }).catch(() => ({ ok: false, code: "error", message: "network" }));
    setLoading(false);
    startCooldown();

    if (!res.ok) {
      if (res.code === "not_found") {
        setFormError("No encontramos una cuenta con ese correo o Nexus Tag.");
      } else if (res.code === "unconfirmed") {
        setNeedsConfirm(res.masked_email ?? "tu correo");
      } else {
        setFormError(translateAuthError(res.message ?? ""));
      }
      return;
    }

    // Instalar la sesión emitida por el servidor en el cliente
    const { error: sessionError } = await nexus.auth.setSession(res.session);
    if (sessionError) {
      setFormError(translateAuthError(sessionError.message));
      return;
    }

    toast.success("¡Bienvenido de vuelta!");
    navigate({ to: homeRouteForRole(res.role ?? null) });
  };

  const resend = async () => {
    await doResend({ data: { identifier: identifier.trim() } }).catch(() => {});
    toast.success("Correo de verificación reenviado");
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldown) return;
    setLoading(true);
    await doReset({
      data: {
        identifier: identifier.trim(),
        redirect_to: `${window.location.origin}/reset-password`,
      },
    }).catch(() => {});
    setLoading(false);
    startCooldown();
    // Respuesta idéntica exista o no la cuenta: sin señal de enumeración.
    setResetSent(true);
  };

  const setMode = (forgot: boolean) => {
    setForgotMode(forgot);
    setFormError(null);
    setResetSent(false);
  };

  if (needsConfirm) {
    return (
      <AuthShell
        title="Verifica tu correo"
        description={
          <>
            Antes de entrar, abre el enlace que enviamos a{" "}
            <span className="text-foreground">{needsConfirm}</span>.
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-foreground-secondary">
            ¿No te llegó? Revisa spam o pide otro.
          </p>
          <button type="button" onClick={resend} className={`${BTN_OUTLINE} w-full`}>
            Reenviar verificación
          </button>
          <button
            type="button"
            onClick={() => setNeedsConfirm(null)}
            className={`${TEXT_LINK} w-full justify-center`}
          >
            Volver a iniciar sesión
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={forgotMode ? "Recupera tu acceso" : "Inicia sesión"}
      description={
        forgotMode
          ? "Te enviaremos un enlace para elegir una contraseña nueva."
          : "Entra para seguir tu ranking y registrar tus partidas."
      }
      footer={
        !forgotMode && (
          <div className="space-y-1">
            <p className="text-foreground-secondary">
              ¿No tienes cuenta?{" "}
              <Link to="/signup" className={`${TEXT_LINK} text-foreground`}>
                Crea tu cuenta
              </Link>
            </p>
            <Link to="/" className={TEXT_LINK}>
              Ver el ranking sin cuenta
            </Link>
          </div>
        )
      }
    >
      {forgotMode && resetSent ? (
        <div role="status" className="space-y-4">
          <p className="text-foreground">Si la cuenta existe, ya enviamos el enlace.</p>
          <p className="text-sm text-foreground-secondary">
            Revisa tu bandeja de entrada y spam. El enlace te lleva a elegir tu contraseña nueva.
          </p>
          <button type="button" onClick={() => setMode(false)} className={`${BTN_OUTLINE} w-full`}>
            Volver a iniciar sesión
          </button>
        </div>
      ) : (
        <form onSubmit={forgotMode ? sendReset : submit} className="space-y-4">
          <Field id="login-id" label="Nexus Tag o correo">
            <input
              {...fieldProps("login-id")}
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="VoidStriker o jugador@correo.com"
              className={authInput()}
            />
          </Field>

          {!forgotMode && (
            <Field
              id="login-pass"
              label="Contraseña"
              aside={
                <button type="button" onClick={() => setMode(true)} className={TEXT_LINK}>
                  ¿La olvidaste?
                </button>
              }
            >
              <PasswordInput
                {...fieldProps("login-pass")}
                show={showPass}
                onToggle={() => setShowPass((v) => !v)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </Field>
          )}

          {formError && <FormError>{formError}</FormError>}

          <button type="submit" disabled={loading || cooldown} className={`${BTN_PRIMARY} w-full`}>
            {loading && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
            {forgotMode
              ? loading
                ? "Enviando…"
                : "Enviar enlace"
              : loading
                ? "Entrando…"
                : "Entrar"}
          </button>

          {forgotMode && (
            <button
              type="button"
              onClick={() => setMode(false)}
              className={`${TEXT_LINK} w-full justify-center`}
            >
              Volver a iniciar sesión
            </button>
          )}
        </form>
      )}
    </AuthShell>
  );
}
