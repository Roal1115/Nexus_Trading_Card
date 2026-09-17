import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Store as StoreIcon, Trophy } from "lucide-react";
import { getActiveSponsor, registerAdView } from "@/lib/nexus-ads.functions";
import { logStorePageView } from "@/lib/nexus-public.functions";
import { AdVertical } from "@/components/ads/AdVertical";
import { AdHorizontal } from "@/components/ads/AdHorizontal";
import { storeProfileQuery } from "@/lib/stores-queries";
import { SkeletonLine, SkeletonBlock } from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/stores/$slug")({
  head: () => ({ meta: [{ title: "Tienda — Nexus" }] }),
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(storeProfileQuery(params.slug));
    } catch {
      return undefined;
    }
  },
  component: StoreLayout,
});

// Refleja la estructura real de la página (hero, ubicación/actividad,
// calendario, historial) en vez de un spinner genérico — evita el salto de
// layout entre "cargando" y "cargado" que un spinner centrado no previene.
function StoreProfileSkeleton() {
  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-[160px_minmax(0,1fr)_160px]">
      <aside className="hidden xl:block" />
      <main className="min-w-0 max-w-4xl space-y-6 py-10">
        <SkeletonLine width="w-40" height="h-3" />

        <div className="glass space-y-4 rounded-2xl p-6">
          <SkeletonLine width="w-24" height="h-3" />
          <SkeletonLine width="w-2/3" height="h-8" />
          <SkeletonLine width="w-full" height="h-4" />
          <div className="flex gap-2">
            <SkeletonLine width="w-20" height="h-6" className="rounded-md" />
            <SkeletonLine width="w-24" height="h-6" className="rounded-md" />
          </div>
          <div className="flex gap-2 pt-2">
            <SkeletonBlock className="h-9 w-32 rounded-md" />
            <SkeletonBlock className="h-9 w-9 rounded-md" />
            <SkeletonBlock className="h-9 w-9 rounded-md" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="glass space-y-3 rounded-2xl p-6">
            <SkeletonLine width="w-40" height="h-4" />
            <SkeletonLine width="w-full" height="h-3" />
            <SkeletonLine width="w-3/4" height="h-3" />
          </div>
          <div className="glass space-y-3 rounded-2xl p-6">
            <SkeletonLine width="w-32" height="h-4" />
            <SkeletonBlock className="h-9 w-full rounded-lg" />
            <SkeletonBlock className="h-9 w-full rounded-lg" />
            <SkeletonBlock className="h-9 w-full rounded-lg" />
          </div>
        </div>

        <div className="glass space-y-4 rounded-2xl p-6">
          <SkeletonLine width="w-48" height="h-4" />
          <SkeletonBlock className="h-96 w-full rounded-lg" />
        </div>
      </main>
      <aside className="hidden xl:block" />
    </div>
  );
}

const TABS = [
  { to: "/stores/$slug", label: "Perfil", icon: <StoreIcon size={14} />, exact: true },
  {
    to: "/stores/$slug/tournaments",
    label: "Torneos y Liga",
    icon: <Trophy size={14} />,
    exact: false,
  },
];

function StoreLayout() {
  const { slug } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: profileData, isLoading: loading } = useQuery({
    ...storeProfileQuery(slug),
    initialData: loaderData,
    retry: false,
  });
  const store = profileData?.store ?? null;
  const notFound = !loading && !store;

  const fetchActiveSponsor = useServerFn(getActiveSponsor);
  const registerView = useServerFn(registerAdView);
  const [sponsor, setSponsor] = useState<any>(null);

  useEffect(() => {
    registerView()
      .then(setSponsor)
      .catch(() => {
        fetchActiveSponsor()
          .then(setSponsor)
          .catch(() => {});
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Visita de "profile" al entrar a la tienda — las visitas a
  // "calendario"/"liga_interna" se registran en la sub-ruta de torneos,
  // que ahora es una página propia en vez de un anchor dentro del scroll.
  const logView = useServerFn(logStorePageView);
  useEffect(() => {
    if (!store?.id) return;
    logView({ data: { store_id: store.id, section: "profile" } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  if (loading) {
    return <StoreProfileSkeleton />;
  }

  if (notFound || !store) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-gray-400">No encontramos esta tienda.</p>
        <Link to="/stores" className="text-sm font-semibold text-primary hover:underline">
          ← Volver al directorio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-[160px_minmax(0,1fr)_160px]">
      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>

      <main className="min-w-0 max-w-4xl space-y-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/stores"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-primary"
          >
            <ArrowLeft size={12} /> Volver al directorio
          </Link>
        </div>

        {/* Ad horizontal mobile */}
        <AdHorizontal sponsor={sponsor} />

        <nav className="flex gap-1 border-b border-white/10">
          {TABS.map((tab) => {
            const to = tab.to.replace("$slug", slug);
            const active = tab.exact
              ? pathname === to
              : pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={tab.to}
                to={tab.to}
                params={{ slug }}
                className={`flex items-center gap-1.5 border-b-2 -mb-px px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                  active
                    ? "border-primary text-white"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <Outlet />
      </main>

      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>
    </div>
  );
}
