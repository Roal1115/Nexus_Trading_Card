import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { registerSponsorView } from "@/lib/geekarena-ads.functions";

export function AdHorizontal({ sponsor }: { sponsor: any }) {
  const registerSponsorViewFn = useServerFn(registerSponsorView);

  useEffect(() => {
    if (!sponsor?.id) return;
    // Una vista por sponsor por sesión de navegador (clave compartida con AdVertical)
    const key = `ad_viewed_${sponsor.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    registerSponsorViewFn({ data: { sponsor_id: sponsor.id } }).catch(() => {});
  }, [sponsor?.id]);

  if (!sponsor?.horizontal_url) return null;
  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 xl:hidden sm:hidden">
      <img
        src={sponsor.horizontal_url}
        alt={sponsor.name ?? "Patrocinador"}
        width={640}
        height={100}
        className="w-full h-[100px] object-cover rounded-lg"
        loading="lazy"
      />
    </div>
  );
}
