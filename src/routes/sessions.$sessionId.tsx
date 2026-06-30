import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sessions/$sessionId")({
  head: () => ({ meta: [{ title: "Sesión — Geek Arena" }] }),
  component: SessionDetailPage,
});

function SessionDetailPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <p className="text-sm text-gray-400">Cargando sesión…</p>
    </main>
  );
}
