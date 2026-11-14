import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { nexus } from "@/integrations/nexus/client";
import { BTN_OUTLINE } from "@/components/stores/store-ui";
import { AuthShell, TEXT_LINK } from "@/components/auth/auth-ui";

export const Route = createFileRoute("/check-inbox")({
  head: () => ({ meta: [{ title: "Revisa tu correo — Nexus" }] }),
  validateSearch: (s) => ({ email: (s.email as string) ?? "" }),
  component: CheckInboxPage,
});

function CheckInboxPage() {
  const { email } = Route.useSearch();
  const [cooldown, setCooldown] = useState(false);

  const resend = async () => {
    if (!email || cooldown) return;
    setCooldown(true);
    setTimeout(() => setCooldown(false), 30_000);
    const { error } = await nexus.auth.resend({ type: "signup", email });
    if (error) toast.error("Ocurrió un error. Intenta de nuevo en unos momentos");
    else toast.success("Nuevo correo de verificación enviado");
  };

  return (
    <AuthShell
      title="Revisa tu correo"
      description={
        <>
          Te enviamos un enlace de verificación a{" "}
          <span className="break-words text-foreground">{email || "tu correo"}</span>. Ábrelo para
          activar tu cuenta y entrar a Nexus.
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-foreground-secondary">
          ¿No te llegó en unos minutos? Revisa spam o pide otro.
        </p>
        <button
          type="button"
          onClick={resend}
          disabled={!email || cooldown}
          className={`${BTN_OUTLINE} w-full`}
        >
          {cooldown ? "Enviado. Puedes pedir otro en 30 s" : "Reenviar correo"}
        </button>
        <Link to="/login" className={`${TEXT_LINK} w-full justify-center`}>
          Volver a iniciar sesión
        </Link>
      </div>
    </AuthShell>
  );
}
