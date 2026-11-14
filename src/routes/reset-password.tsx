import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { nexus } from "@/integrations/nexus/client";
import { PasswordStrength, passwordIsValid } from "@/components/ui/PasswordStrength";
import { BTN_OUTLINE, BTN_PRIMARY } from "@/components/stores/store-ui";
import { AuthShell, Field, FormError, PasswordInput, fieldProps } from "@/components/auth/auth-ui";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Restablecer contraseña — Nexus" }] }),
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
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase establece la sesión de recuperación automáticamente al detectar
    // el token en la URL (hash o query param) cuando el cliente carga.
    nexus.auth.getSession().then(({ data }) => {
      setValidSession(!!data.session);
      setChecking(false);
    });

    const { data: listener } = nexus.auth.onAuthStateChange((event, session) => {
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

    setFormError(null);
    if (!passwordIsValid(password)) {
      setFormError(
        "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { error } = await nexus.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setFormError(translateAuthError(error.message));
      return;
    }
    setDone(true);
    toast.success("Contraseña actualizada con éxito");
    setTimeout(() => navigate({ to: "/login" }), 2000);
  };

  const mismatch =
    confirmPassword.length > 0 && confirmPassword !== password
      ? "Las contraseñas no coinciden"
      : undefined;

  return (
    <AuthShell title="Nueva contraseña" description="Elige una contraseña nueva para tu cuenta.">
      {checking ? (
        <p role="status" className="flex items-center gap-2 text-sm text-foreground-secondary">
          <Loader2 size={16} aria-hidden="true" className="animate-spin" />
          Verificando enlace…
        </p>
      ) : !validSession ? (
        <div className="space-y-4">
          <p className="text-foreground">Este enlace expiró o ya se usó.</p>
          <p className="text-sm text-foreground-secondary">
            Pide uno nuevo desde "¿La olvidaste?" en la pantalla de inicio de sesión.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/login" })}
            className={`${BTN_OUTLINE} w-full`}
          >
            Ir a iniciar sesión
          </button>
        </div>
      ) : done ? (
        <p role="status" className="text-foreground">
          Listo, tu contraseña cambió. Te llevamos a iniciar sesión…
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field id="reset-pass" label="Nueva contraseña">
            <PasswordInput
              {...fieldProps("reset-pass")}
              show={showPass}
              onToggle={() => setShowPass((v) => !v)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <PasswordStrength password={password} />
          </Field>

          <Field id="reset-pass2" label="Confirmar contraseña" error={mismatch}>
            <PasswordInput
              {...fieldProps("reset-pass2", { error: mismatch })}
              show={showPass}
              onToggle={() => setShowPass((v) => !v)}
              error={mismatch}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>

          {formError && <FormError>{formError}</FormError>}

          <button type="submit" disabled={loading} className={`${BTN_PRIMARY} w-full`}>
            {loading && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
            {loading ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
