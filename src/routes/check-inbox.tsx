import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { geekarena } from "@/integrations/geekarena/client";

export const Route = createFileRoute("/check-inbox")({
  head: () => ({ meta: [{ title: "Check your inbox — Geek Arena" }] }),
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
    if (error) toast.error(error.message);
    else toast.success("New confirmation email sent");
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1e2130] p-10 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-300">
          <Mail size={24} />
        </div>
        <h1 className="text-2xl font-bold text-white">Check your inbox</h1>
        <p className="mt-3 text-sm text-gray-400">
          We sent a confirmation link to{" "}
          <span className="text-white">{email || "your email"}</span>. Click it
          to activate your account before signing in.
        </p>

        <button
          onClick={resend}
          disabled={!email || cooldown}
          className="mt-6 w-full rounded-md border border-violet-500/40 bg-violet-500/10 py-3 text-sm font-bold uppercase tracking-widest text-violet-300 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cooldown ? "Sent — check again soon" : "Resend email"}
        </button>

        <Link
          to="/login"
          className="mt-4 block text-xs uppercase tracking-wider text-gray-500 transition hover:text-violet-300"
        >
          ← Back to sign in
        </Link>
      </div>
    </main>
  );
}
