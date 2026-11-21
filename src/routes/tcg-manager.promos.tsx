import { createFileRoute } from "@tanstack/react-router";
import { PromoReview } from "@/components/admin/promo-review";

export const Route = createFileRoute("/tcg-manager/promos")({
  head: () => ({ meta: [{ title: "Promos de tienda — Nexus" }] }),
  component: PromosPage,
});

function PromosPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Promos de tienda</h1>
      <PromoReview />
    </div>
  );
}
