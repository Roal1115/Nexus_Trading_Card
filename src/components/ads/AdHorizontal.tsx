export function AdHorizontal({ sponsor }: { sponsor: any }) {
  if (!sponsor?.horizontal_url) return null;
  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 xl:hidden">
      <img
        src={sponsor.horizontal_url}
        alt={sponsor.name ?? "Patrocinador"}
        className="block h-auto w-full"
        loading="lazy"
      />
    </div>
  );
}
