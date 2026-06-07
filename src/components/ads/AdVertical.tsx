export function AdVertical({ sponsor }: { sponsor: any }) {
  if (!sponsor?.vertical_url) return null;
  return (
    <div className="sticky top-24 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <img
        src={sponsor.vertical_url}
        alt={sponsor.name ?? "Patrocinador"}
        className="block h-auto w-full"
        loading="lazy"
      />
    </div>
  );
}
