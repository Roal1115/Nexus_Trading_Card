import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { geekarena } from "@/integrations/geekarena/client";

export const Route = createFileRoute("/check-inbox")({
  head: () => ({ meta: [{ title: "Revisa tu correo — Geek Arena" }] }),
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
    const { error } = await geekarena.auth.resend({ type: "signup", email });
    if (error) toast.error("Ocurrió un error. Intenta de nuevo en unos momentos");
    else toast.success("Nuevo correo de verificación enviado");
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1e2130] p-10 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
          <Mail size={24} />
        </div>
        <h1 className="text-2xl font-bold text-white">¡Revisa tu correo!</h1>
        <p className="mt-3 text-sm text-gray-400">
          Te enviamos un enlace de verificación a{" "}
          <span className="text-white">{email || "tu correo"}</span>. Una vez
          confirmado podrás entrar a la Arena.
        </p>

        <button
          onClick={resend}
          disabled={!email || cooldown}
          className="mt-6 w-full rounded-md border border-primary/40 bg-primary/10 py-3 text-sm font-bold uppercase tracking-widest text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cooldown ? "Enviado — espera un momento" : "Reenviar correo"}
        </button>

        <Link
          to="/login"
          className="mt-4 block text-xs uppercase tracking-wider text-gray-500 transition hover:text-primary"
        >
          ← Volver a iniciar sesión
        </Link>
      </div>
    </main>
  );
}
