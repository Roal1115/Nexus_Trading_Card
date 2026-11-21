import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStorePromo, logPromoEvent } from "@/lib/nexus-public.functions";
import { FOCUS_RING } from "./store-ui";

/**
 * Banner de marketing propio de la tienda (aprobado por Admin/Manager). Cuenta una visualización
 * cuando la mitad del banner entra en pantalla y un clic al abrir el link. El servidor deduplica.
 */
export function StorePromo({ storeId }: { storeId: string }) {
  const fetchPromo = useServerFn(getStorePromo);
  const logEvent = useServerFn(logPromoEvent);
  const { data: promo } = useQuery({
    queryKey: ["store-promo", storeId],
    queryFn: () => fetchPromo({ data: { store_id: storeId } }),
    staleTime: 5 * 60 * 1000,
  });

  const ref = useRef<HTMLDivElement>(null);
  const promoId = promo?.id;
  useEffect(() => {
    const el = ref.current;
    if (!el || !promoId) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        logEvent({ data: { promo_id: promoId, kind: "view" } }).catch(() => {});
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoId]);

  if (!promo) return null;

  const image = (
    <img
      src={promo.image_url}
      alt={promo.title}
      width={1280}
      height={400}
      loading="lazy"
      className="aspect-[16/5] w-full object-cover"
    />
  );

  return (
    <div ref={ref} className="overflow-hidden rounded-xl border border-border bg-card">
      {promo.link_url ? (
        <a
          href={promo.link_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={() => logEvent({ data: { promo_id: promo.id, kind: "click" } }).catch(() => {})}
          className={`block ${FOCUS_RING}`}
        >
          {image}
        </a>
      ) : (
        image
      )}
    </div>
  );
}
