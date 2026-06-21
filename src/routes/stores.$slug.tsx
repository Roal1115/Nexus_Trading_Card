import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  MapPin,
  Navigation,
  Clock,
  Instagram,
  Globe,
  Twitter,
  Twitch,
  ArrowLeft,
  Phone,
  MessageCircle,
  CalendarDays,
} from "lucide-react";
import { getStoreProfile, getStoreWeeklySchedule } from "@/lib/geekarena-public.functions";

export const Route = createFileRoute("/stores/$slug")({
  head: () => ({ meta: [{ title: "Tienda — Geek Arena" }] }),
  component: StoreProfilePage,
});

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function getScheduleHourRange(schedule: Array<{ start_time: string }>): number[] {
  if (schedule.length === 0) return [];
  const hours = schedule.map((s) => parseInt(s.start_time.split(":")[0], 10));
  const min = Math.min(...hours);
  const max = Math.max(...hours);
  const range: number[] = [];
  for (let h = min; h <= max; h++) range.push(h);
  return range;
}

function StoreProfilePage() {
  const { slug } = Route.useParams();
  const fetchProfile = useServerFn(getStoreProfile);
  const fetchSchedule = useServerFn(getStoreWeeklySchedule);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [notFound, setNotFound] = useState(false);
  const scheduleHours = useMemo(() => getScheduleHourRange(schedule), [schedule]);

  useEffect(() => {
    fetchProfile({ data: { slug } })
      .then((res: any) => setStore(res.store))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    fetchSchedule({ data: { slug } })
      .then((res: any) => setSchedule(res.schedule ?? []))
      .catch(() => setSchedule([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-gray-400">No encontramos esta tienda.</p>
        <Link to="/stores" className="text-sm font-semibold text-primary hover:underline">
          ← Volver al directorio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <Link
        to="/stores"
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-primary"
      >
        <ArrowLeft size={12} /> Volver al directorio
      </Link>

      <header className="glass space-y-4 rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{store.zone ?? "—"}</p>
        <h1 className="text-3xl font-bold text-white">{store.name}</h1>
        <p className="flex items-center gap-1.5 text-sm text-gray-400">
          <MapPin size={14} /> {[store.address, store.city, store.state].filter(Boolean).join(", ") || "—"}
        </p>

        {store.description && <p className="text-sm text-gray-300">{store.description}</p>}

        {store.games.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {store.games.map((g: any) => (
              <span
                key={g.id}
                className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary"
              >
                {g.name}
              </span>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {store.opening_hours && (
            <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock size={12} /> {store.opening_hours}
              </p>
            </div>
          )}
          {store.phone && (
            <div className="flex gap-2 rounded-md border border-white/10 bg-white/[0.02] p-3">
              <a
                href={`tel:${store.phone.replace(/\s+/g, "")}`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white/5 px-2 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10"
              >
                <Phone size={12} /> Llamar
              </a>
              <a
                href={`https://wa.me/${store.phone.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-500/15 px-2 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25"
              >
                <MessageCircle size={12} /> WhatsApp
              </a>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {store.google_maps_url && (
            <a
              href={store.google_maps_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground"
            >
              <Navigation size={12} /> Cómo llegar
            </a>
          )}
          {store.instagram && (
            <a
              href={`https://instagram.com/${store.instagram.replace("@", "")}`}
              target="_blank"
              rel="noreferrer"
              className="text-gray-400 hover:text-primary"
            >
              <Instagram size={18} />
            </a>
          )}
          {store.website && (
            <a href={store.website} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-primary">
              <Globe size={18} />
            </a>
          )}
          {store.twitter && (
            <a
              href={`https://x.com/${store.twitter.replace("@", "")}`}
              target="_blank"
              rel="noreferrer"
              className="text-gray-400 hover:text-primary"
            >
              <Twitter size={18} />
            </a>
          )}
          {store.twitch && (
            <a
              href={`https://twitch.tv/${store.twitch.replace("@", "")}`}
              target="_blank"
              rel="noreferrer"
              className="text-gray-400 hover:text-primary"
            >
              <Twitch size={18} />
            </a>
          )}
        </div>
      </header>

      {schedule.length > 0 && (
        <div className="glass space-y-4 rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <CalendarDays size={18} className="text-primary" />
            Horario de torneos
          </h2>
          <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ minWidth: "760px", width: "100%" }}>
                <div
                  style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)" }}
                  className="border-b border-white/10"
                >
                  <div className="border-r border-white/5" />
                  {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
                    <div key={dow} className="p-2 text-center border-l border-white/10">
                      <div className="text-[10px] uppercase text-gray-400">{DAY_NAMES[dow]}</div>
                    </div>
                  ))}
                </div>

                {scheduleHours.map((hour) => (
                  <div
                    key={hour}
                    style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)" }}
                    className="border-b border-white/5"
                  >
                    <div className="p-2 text-[10px] text-gray-500 text-right border-r border-white/5 flex items-start justify-end pt-2">
                      {hour}:00
                    </div>
                    {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                      const cellEntries = schedule.filter(
                        (s) => s.day_of_week === dow && parseInt(s.start_time.split(":")[0], 10) === hour,
                      );
                      return (
                        <div
                          key={dow}
                          className="min-h-[50px] p-1 border-l border-white/10"
                          style={{ minWidth: 0, overflow: "hidden" }}
                        >
                          {cellEntries.map((e, idx) => (
                            <div
                              key={idx}
                              className="w-full text-left rounded px-1.5 py-1 mb-0.5 bg-primary/10 border border-primary/30"
                            >
                              <div className="text-[10px] text-primary truncate">{e.game_name}</div>
                              <div className="text-[9px] text-gray-400 truncate">{e.start_time}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
