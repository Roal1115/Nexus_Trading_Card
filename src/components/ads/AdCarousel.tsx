export function AdCarousel({ sponsors }: { sponsors: any[] }) {
  if (!sponsors || sponsors.length === 0) return null;
  const items = [...sponsors, ...sponsors];

  return (
    <div className="my-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
        Patrocinado por
      </p>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-gradient-to-l from-background to-transparent" />
        <div className="flex w-max gap-10 animate-marquee">
          {items.map((s, i) =>
            s.logo_url ? (
              <img
                key={`${s.id}-${i}`}
                src={s.logo_url}
                alt={s.name}
                className="h-16 w-auto shrink-0 opacity-80 transition hover:opacity-100"
                loading="lazy"
              />
            ) : (
              <span
                key={`${s.id}-${i}`}
                className="flex h-16 shrink-0 items-center px-4 text-sm font-semibold uppercase tracking-wider text-gray-400"
              >
                {s.name}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
