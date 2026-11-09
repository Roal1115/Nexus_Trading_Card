import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import {
  CalendarPlus,
  CheckCircle2,
  Globe,
  Instagram,
  MapPin,
  Navigation,
  Phone,
  Twitch,
  Twitter,
  X,
} from "lucide-react";
import { acceptsSlotRsvp, SlotRsvpPanel } from "@/components/calendar/slot-rsvp";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildIcs, icsDataUri, icsFileName } from "@/lib/ics";
import { todayInMexicoStr } from "@/lib/utils";

/** Detalle de un torneo: diálogo en escritorio y panel inferior en móvil. */
export function TournamentDetailDialog({
  entry,
  playerId,
  attended = false,
  onClose,
}: {
  entry: any;
  playerId: string | undefined;
  attended?: boolean;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Drawer open onOpenChange={(o) => !o && onClose()}>
        <DrawerContent className="z-[90] max-h-[90dvh]">
          <div className="overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
            <TournamentDetail
              entry={entry}
              playerId={playerId}
              attended={attended}
              Title={DrawerTitle}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal forceMount>
        <DialogPrimitive.Overlay asChild forceMount>
          <div className="animate-in fade-in-0 duration-200 fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
            <DialogPrimitive.Content
              asChild
              forceMount
              onClick={(e) => e.stopPropagation()}
              aria-describedby={undefined}
            >
              <div className="animate-in fade-in-0 zoom-in-95 duration-200 glass relative my-auto w-full max-w-md rounded-2xl p-6">
                <DialogPrimitive.Close
                  aria-label="Cerrar"
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-md text-foreground-secondary transition hover:bg-white/10 hover:text-foreground"
                >
                  <X size={18} />
                </DialogPrimitive.Close>
                <TournamentDetail
                  entry={entry}
                  playerId={playerId}
                  attended={attended}
                  Title={DialogPrimitive.Title}
                />
              </div>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function buildEventIcs(entry: any) {
  const isProjected = Boolean(entry.is_scheduled);
  const title = isProjected
    ? `${entry.game_name} — ${entry.store_name} (por confirmar)`
    : `${entry.game_name} — ${entry.store_name}`;
  const description = isProjected
    ? "Horario regular de la tienda, sujeto a cambios. Trading Card Nexus."
    : "Torneo publicado en Trading Card Nexus.";
  const location = [entry.store_name, entry.store_city, entry.store_state]
    .filter(Boolean)
    .join(", ");
  return buildIcs({
    title,
    description,
    location,
    date: entry.date,
    time: entry.time,
    durationHours: 4,
    uid: `${entry.id}-${entry.date}`,
  });
}

function fullDate(date: string): string {
  const text = new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const secondaryAction =
  "flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition hover:bg-white/5";

function TournamentDetail({
  entry,
  playerId,
  attended,
  Title,
}: {
  entry: any;
  playerId: string | undefined;
  attended: boolean;
  /** El título accesible depende del contenedor: diálogo o panel inferior. */
  Title: React.ElementType;
}) {
  const isPast = entry.date < todayInMexicoStr();
  const location = [entry.store_address, entry.store_city, entry.store_state]
    .filter(Boolean)
    .join(", ");
  const networks = [
    entry.store_instagram && {
      label: "Instagram",
      href: `https://instagram.com/${entry.store_instagram.replace("@", "")}`,
      icon: <Instagram size={14} />,
    },
    entry.store_twitter && {
      label: "X",
      href: `https://x.com/${entry.store_twitter.replace("@", "")}`,
      icon: <Twitter size={14} />,
    },
    entry.store_twitch && {
      label: "Twitch",
      href: `https://twitch.tv/${entry.store_twitch.replace("@", "")}`,
      icon: <Twitch size={14} />,
    },
    entry.store_website && {
      label: "Sitio web",
      href: entry.store_website,
      icon: <Globe size={14} />,
    },
  ].filter(Boolean) as { label: string; href: string; icon: React.ReactNode }[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 pr-10">
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
          {entry.game_name}
        </span>
        {entry.league_name && (
          <span className="rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-xs font-semibold text-fuchsia-300">
            {entry.league_name}
          </span>
        )}
      </div>

      <div>
        <Title asChild>
          <h3 className="text-xl font-bold text-foreground">
            {fullDate(entry.date)}
            {entry.time ? ` · ${entry.time.slice(0, 5)}` : ""}
          </h3>
        </Title>
        <p className="mt-0.5 text-base font-medium text-foreground-secondary">{entry.store_name}</p>
      </div>

      <div className="flex items-start justify-between gap-3 text-sm text-foreground-secondary">
        <p className="flex min-w-0 items-start gap-2">
          <MapPin size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            {location || entry.zone}
            {location && <span className="block text-xs">{entry.zone}</span>}
          </span>
        </p>
        {entry.store_google_maps_url && (
          <a
            href={entry.store_google_maps_url}
            target="_blank"
            rel="noreferrer"
            className="flex flex-shrink-0 items-center gap-1 font-semibold text-primary hover:underline"
          >
            <Navigation size={13} /> Cómo llegar
          </a>
        )}
      </div>

      {playerId && !entry.is_scheduled && attended && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400">Asististe a este torneo</span>
        </div>
      )}

      {acceptsSlotRsvp(entry) && !isPast && <SlotRsvpPanel entry={entry} playerId={playerId} />}

      <div className="grid gap-2 sm:grid-cols-2">
        {!entry.is_scheduled && (
          <Link to="/tournaments/$id" params={{ id: entry.id }} className={secondaryAction}>
            Ver resultados
          </Link>
        )}
        {!isPast && (
          <a
            href={icsDataUri(buildEventIcs(entry))}
            download={icsFileName(`${entry.game_name}-${entry.store_name}-${entry.date}`)}
            className={secondaryAction}
          >
            <CalendarPlus size={15} /> Agregar a mi calendario
          </a>
        )}
        {entry.store_slug && (
          <Link to="/stores/$slug" params={{ slug: entry.store_slug }} className={secondaryAction}>
            Ver tienda
          </Link>
        )}
      </div>

      {(entry.store_phone || networks.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-divider pt-3 text-xs text-foreground-secondary">
          {entry.store_phone && (
            <a
              href={`tel:${entry.store_phone}`}
              className="flex items-center gap-1.5 hover:text-primary"
            >
              <Phone size={14} /> {entry.store_phone}
            </a>
          )}
          {networks.map((n) => (
            <a
              key={n.label}
              href={n.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-primary"
            >
              {n.icon} {n.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
