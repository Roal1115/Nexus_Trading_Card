export function AdCarousel({
  sponsors,
}: {
  sponsors: Array<{ id: string; name: string; carousel_url: string | null }>;
}) {
  const withCarousel = (sponsors ?? []).filter((s) => s.carousel_url);
  if (withCarousel.length === 0) return null;

  // Duplicar suficientes veces para que el carrusel se vea continuo
  const MIN_ITEMS = 8;
  const repeated = Array.from(
    { length: Math.ceil(MIN_ITEMS / withCarousel.length) * 2 },
    (_, i) => withCarousel[i % withCarousel.length],
  );

  return (
    <div className="my-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400">
        Patrocinado por
      </p>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-gradient-to-l from-background to-transparent" />
        <div className="flex w-max gap-10 animate-marquee">
          {repeated.map((s, i) => (
            <img
              key={`${s.id}-${i}`}
              src={s.carousel_url!}
              alt={s.name}
              className="h-16 w-auto shrink-0 opacity-80 transition hover:opacity-100"
              loading="lazy"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
