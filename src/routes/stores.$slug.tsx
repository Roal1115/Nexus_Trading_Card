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
import { StoreHero } from "@/components/stores/store-hero";
import { BTN_OUTLINE, FOCUS_RING, InlineError, SECTION } from "@/components/stores/store-ui";
import { SkeletonLine, SkeletonBlock } from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/stores/$slug")({
  head: ({ loaderData }) => {
    const name = (loaderData as { store?: { name?: string } } | undefined)?.store?.name;
    return { meta: [{ title: name ? `${name} — Nexus` : "Tienda — Nexus" }] };
  },
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
      <main aria-busy="true" className="@container min-w-0 max-w-4xl space-y-6 py-10">
        <SkeletonLine width="w-40" height="h-4" />

        <div className={`${SECTION} space-y-4`}>
          <SkeletonLine width="w-2/3" height="h-8" />
          <SkeletonLine width="w-1/3" height="h-4" />
          <div className="flex gap-2 pt-2">
            <SkeletonBlock className="h-11 w-32 rounded-md" />
            <SkeletonBlock className="h-11 w-11 rounded-md" />
          </div>
          <SkeletonBlock className="h-16 w-full rounded-lg" />
        </div>

        <div className="grid gap-4 @2xl:grid-cols-2">
          <div className={`${SECTION} space-y-3`}>
            <SkeletonLine width="w-40" height="h-4" />
            <SkeletonLine width="w-full" height="h-3" />
            <SkeletonLine width="w-3/4" height="h-3" />
          </div>
          <div className={`${SECTION} space-y-3`}>
            <SkeletonLine width="w-32" height="h-4" />
            <SkeletonBlock className="h-11 w-full rounded-lg" />
            <SkeletonBlock className="h-11 w-full rounded-lg" />
          </div>
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

  const {
    data: profileData,
    isLoading: loading,
    error,
    isError,
    refetch,
  } = useQuery({
    ...storeProfileQuery(slug),
    initialData: loaderData,
    retry: false,
  });
  const store = profileData?.store ?? null;

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

  // Un fallo de red no es una tienda inexistente: se distingue para ofrecer "Reintentar".
  // getStoreProfile lanza "Tienda no encontrada" cuando el slug no existe.
  if (isError && !store && !/no encontrada/i.test(error?.message ?? "")) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-16 sm:px-6">
        <h1 className="text-xl font-bold text-foreground">No pudimos cargar la tienda</h1>
        <InlineError onRetry={() => refetch()}>
          Revisa tu conexión e inténtalo de nuevo.
        </InlineError>
        <Link to="/stores" className={BTN_OUTLINE}>
          Ver directorio de tiendas
        </Link>
      </main>
    );
  }

  if (!store) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-16 sm:px-6">
        <h1 className="text-xl font-bold text-foreground">No encontramos esta tienda</h1>
        <p className="text-sm text-foreground-secondary">
          Puede que el enlace esté mal escrito o que la tienda ya no esté en el circuito.
        </p>
        <Link to="/stores" className={BTN_OUTLINE}>
          Ver directorio de tiendas
        </Link>
      </main>
    );
  }

  // Sin patrocinador no se reserva el espacio de las columnas laterales.
  const hasSideAds = Boolean(sponsor?.vertical_url);

  return (
    <div
      className={`mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 ${
        hasSideAds ? "xl:grid-cols-[160px_minmax(0,1fr)_160px]" : ""
      }`}
    >
      {hasSideAds && (
        <aside className="hidden xl:block">
          <AdVertical sponsor={sponsor} />
        </aside>
      )}

      <main className="@container mx-auto w-full min-w-0 max-w-4xl space-y-6 py-10">
        <Link
          to="/stores"
          className={`inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-foreground-secondary transition hover:text-foreground ${FOCUS_RING}`}
        >
          <ArrowLeft size={14} aria-hidden="true" /> Volver al directorio
        </Link>

        {/* Ad horizontal mobile */}
        <AdHorizontal sponsor={sponsor} />

        <StoreHero store={store} />

        <nav aria-label="Secciones de la tienda" className="flex gap-1 border-b border-border">
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
                activeOptions={{ exact: tab.exact }}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex min-h-11 items-center gap-1.5 border-b-2 px-4 text-sm font-medium transition ${FOCUS_RING} ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-foreground-secondary hover:text-foreground"
                }`}
              >
                <span aria-hidden="true">{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <Outlet />
      </main>

      {hasSideAds && (
        <aside className="hidden xl:block">
          <AdVertical sponsor={sponsor} />
        </aside>
      )}
    </div>
  );
}
