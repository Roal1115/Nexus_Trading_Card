import { DetailDialog, ExternalLink, type DetailItem } from "@/components/ui/detail-dialog";
import { safeHref } from "@/lib/utils";

/** Campos que Admin y Manager ya cargan de cada tienda. */
export type StoreDetail = {
  name: string;
  city: string | null;
  state: string | null;
  is_active: boolean | null;
  address?: string | null;
  phone?: string | null;
  google_maps_url?: string | null;
  description?: string | null;
  opening_hours?: string | null;
  instagram?: string | null;
  website?: string | null;
  twitter?: string | null;
  twitch?: string | null;
  zone?: string | null;
  subzone?: string | null;
};

const handleUrl = (base: string, handle: string | null | undefined) =>
  handle ? `${base}${handle.replace(/^@/, "")}` : undefined;

/** Ficha de solo lectura de una tienda. `extra` agrega lo que cada panel sabe de más. */
export function StoreDetailDialog({
  store,
  onClose,
  extra = [],
}: {
  store: StoreDetail | null;
  onClose: () => void;
  extra?: DetailItem[];
}) {
  if (!store) return null;
  const s = store;
  return (
    <DetailDialog
      open
      onClose={onClose}
      title={s.name}
      subtitle={[s.city, s.state].filter(Boolean).join(", ") || undefined}
      badges={
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            s.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-muted-foreground"
          }`}
        >
          {s.is_active ? "Activa" : "Inactiva"}
        </span>
      }
      sections={[
        {
          title: "Ubicación",
          items: [
            { label: "Dirección", value: s.address, wide: true },
            { label: "Zona", value: s.zone },
            { label: "Subzona", value: s.subzone },
            {
              label: "Google Maps",
              value: <ExternalLink href={safeHref(s.google_maps_url)}>Abrir mapa</ExternalLink>,
            },
          ],
        },
        {
          title: "Contacto y redes",
          items: [
            { label: "Teléfono de la tienda", value: s.phone },
            {
              label: "Página web",
              value: <ExternalLink href={safeHref(s.website)}>{s.website}</ExternalLink>,
            },
            {
              label: "Instagram",
              value: s.instagram && (
                <ExternalLink href={handleUrl("https://instagram.com/", s.instagram)}>
                  @{s.instagram.replace(/^@/, "")}
                </ExternalLink>
              ),
            },
            {
              label: "X / Twitter",
              value: s.twitter && (
                <ExternalLink href={handleUrl("https://x.com/", s.twitter)}>
                  @{s.twitter.replace(/^@/, "")}
                </ExternalLink>
              ),
            },
            {
              label: "Twitch",
              value: s.twitch && (
                <ExternalLink href={handleUrl("https://twitch.tv/", s.twitch)}>
                  {s.twitch}
                </ExternalLink>
              ),
            },
          ],
        },
        {
          title: "Operación",
          items: [
            { label: "Horario", value: s.opening_hours, wide: true },
            ...extra,
            { label: "Descripción", value: s.description, wide: true },
          ],
        },
      ]}
    />
  );
}
