import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { registerSponsorView } from "@/lib/geekarena-ads.functions";

export function AdVertical({ sponsor }: { sponsor: any }) {
  const registerSponsorViewFn = useServerFn(registerSponsorView);

  useEffect(() => {
    if (!sponsor?.id) return;
    // Una vista por sponsor por sesión de navegador
    const key = `ad_viewed_${sponsor.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    registerSponsorViewFn({ data: { sponsor_id: sponsor.id } }).catch(() => {});
  }, [sponsor?.id]);

  return (
    <div className="hidden xl:flex flex-col items-center w-[160px] flex-shrink-0">
      {sponsor?.vertical_url && (
        <div className="sticky top-8 flex flex-col items-center gap-4">
          <img
            src={sponsor.vertical_url}
            alt={`Patrocinado por ${sponsor.name}`}
            width={160}
            height={600}
            className="rounded-lg object-cover"
            style={{ width: "160px", height: "600px" }}
          />
          <img
            src={sponsor.vertical_url}
            alt={`Patrocinado por ${sponsor.name}`}
            width={160}
            height={600}
            className="rounded-lg object-cover opacity-90"
            style={{ width: "160px", height: "600px" }}
          />
        </div>
      )}
    </div>
  );
}
