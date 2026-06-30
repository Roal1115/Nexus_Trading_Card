import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sessions")({
  head: () => ({ meta: [{ title: "Mis Sesiones — Geek Arena" }] }),
  component: SessionsPage,
});

function SessionsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Performance</h1>
        <p className="text-sm text-gray-400">Mis Sesiones</p>
      </div>
    </main>
  );
}
