import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { todayInMexicoStr } from "@/lib/utils";
import {
  cancelScheduleOccurrence,
  countPendingFichas,
  getFichaEditor,
  listPendingFichas,
  restoreScheduleOccurrence,
  reviewFicha,
  saveFicha,
} from "@/lib/nexus-schedule-events.functions";
import {
  addDays,
  CANCEL_REASONS,
  describeFichaChanges,
  creditPercentTotal,
  DEFAULT_CREDIT_SPLIT,
  MIN_NOTICE_DAYS,
  PRIZE_KINDS,
  prizeText,
  type Prize,
  type PrizeKind,
} from "@/lib/ficha";

type Occurrence = {
  store_id: string;
  game_id: string;
  league_id?: string | null;
  date: string;
  has_ended?: boolean;
  is_ongoing?: boolean;
  report_status: string;
  cancellation_reason?: string | null;
};

const inputClass =
  "w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-primary";
const labelClass = "text-[10px] uppercase text-gray-500";
const smallButton =
  "inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/5 disabled:opacity-40";

const errorText = (e: unknown) => String((e as Error).message ?? e);

function slotOf(entry: Occurrence) {
  return {
    store_id: entry.store_id,
    game_id: entry.game_id,
    league_id: entry.league_id ?? null,
    date: entry.date,
  };
}

/** Cancelar o restaurar una sola fecha de un horario semanal. */
export function CancelOccurrenceSection({
  entry,
  onSaved,
}: {
  entry: Occurrence;
  onSaved: () => void;
}) {
  const cancelFn = useServerFn(cancelScheduleOccurrence);
  const restoreFn = useServerFn(restoreScheduleOccurrence);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const closed = entry.has_ended || entry.is_ongoing;

  async function run(action: () => Promise<unknown>, message: string) {
    setSaving(true);
    try {
      await action();
      toast.success(message);
      onSaved();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  if (entry.cancellation_reason) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
        <div className="text-sm text-red-200">
          <strong>Cancelado.</strong> {entry.cancellation_reason}
        </div>
        {!closed && (
          <button
            disabled={saving}
            className={`${smallButton} shrink-0`}
            onClick={() =>
              run(
                () => restoreFn({ data: slotOf(entry) }),
                "Torneo restaurado. Se avisó a los jugadores.",
              )
            }
          >
            <RotateCcw size={12} /> Deshacer
          </button>
        )}
      </div>
    );
  }
  if (closed || entry.report_status === "submitted") return null;

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
        <div className="text-xs text-gray-400">
          Cancela solo esta fecha y avisa a los jugadores.
        </div>
        <button className={`${smallButton} shrink-0 text-red-300`} onClick={() => setOpen(true)}>
          <Ban size={12} /> Cancelar torneo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-red-500/30 bg-black/30 p-3">
      <div className={labelClass}>Motivo (se publica y se envía a los jugadores)</div>
      <div className="flex flex-wrap gap-2">
        {CANCEL_REASONS.map((r) => (
          <button key={r} type="button" className={smallButton} onClick={() => setReason(r)}>
            {r}
          </button>
        ))}
      </div>
      <input
        value={reason}
        maxLength={200}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Escribe el motivo"
        className={inputClass}
      />
      <div className="flex justify-end gap-2">
        <button className={smallButton} disabled={saving} onClick={() => setOpen(false)}>
          Volver
        </button>
        <button
          disabled={saving || reason.trim().length < 3}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          onClick={() =>
            run(
              () => cancelFn({ data: { ...slotOf(entry), reason: reason.trim() } }),
              "Torneo cancelado. Se avisó a los jugadores.",
            )
          }
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
          Confirmar cancelación
        </button>
      </div>
    </div>
  );
}

type FichaForm = {
  entry_fee_mxn: string;
  prizes: { place: string; kind: PrizeKind; amount: string }[];
  pool_percent: string;
  format: string;
  capacity: string;
  registration_time: string;
  notes: string;
};

const formFrom = (row: any): FichaForm => ({
  entry_fee_mxn: row ? String(row.entry_fee_mxn) : "",
  prizes: (row?.prizes ?? []).map((p: Prize) => ({ ...p, amount: String(p.amount) })),
  pool_percent: row?.pool_percent ? String(row.pool_percent) : "100",
  format: row?.format ?? "",
  capacity: row?.capacity ? String(row.capacity) : "",
  registration_time: row?.registration_time?.slice(0, 5) ?? "",
  notes: row?.notes ?? "",
});

const termsText = (row: any) =>
  [
    row.entry_fee_mxn === 0 ? "Gratis" : `$${row.entry_fee_mxn} MXN`,
    ...row.prizes.map((p: Prize) => `${p.place}: ${prizeText(p)}`),
    ...(row.pool_percent ? [`Pool: ${row.pool_percent}% de las inscripciones`] : []),
  ].join(" · ");

/** Datos del torneo de la tienda y el juego, para toda la temporada. */
export function FichaSection({ entry }: { entry: Occurrence }) {
  const fetchEditor = useServerFn(getFichaEditor);
  const saveFn = useServerFn(saveFicha);
  const scope = { store_id: entry.store_id, game_id: entry.game_id };
  const { data, refetch, isPending } = useQuery({
    queryKey: ["ficha-editor", scope],
    queryFn: () => fetchEditor({ data: scope }),
  });
  const [form, setForm] = useState<FichaForm | null>(null);
  const [saving, setSaving] = useState(false);

  // Las ligas internas no tienen datos de temporada propios.
  if (entry.league_id || isPending || !data) return null;
  const shown: any = data.pending ?? data.upcoming ?? data.current ?? null;

  const patch = (p: Partial<FichaForm>) => setForm((f) => (f ? { ...f, ...p } : f));
  const parsedPrizes = (form?.prizes ?? []).map((p) => ({ ...p, amount: Number(p.amount) }));
  const usesCredit = creditPercentTotal(parsedPrizes) > 0;
  const prizeHint = parsedPrizes.some((p) => !p.place.trim())
    ? "Escribe la posición de cada premio, por ejemplo 1.º lugar o Participación."
    : parsedPrizes.some((p) => p.amount < 1)
      ? "Cada premio necesita una cantidad."
      : creditPercentTotal(parsedPrizes) > 100
        ? `El crédito suma ${creditPercentTotal(parsedPrizes)}% y no puede pasar del 100% del pool.`
        : usesCredit && !(Number(form?.pool_percent) >= 1 && Number(form?.pool_percent) <= 100)
          ? "Indica qué porcentaje de las inscripciones va al pool."
          : null;

  // El primer premio en crédito propone el reparto normal; se puede editar.
  const changeKind = (index: number, kind: PrizeKind) => {
    if (!form) return;
    const hasCredit = form.prizes.some((p) => p.kind === "store_credit");
    const split =
      kind === "store_credit" && !hasCredit
        ? DEFAULT_CREDIT_SPLIT.map((p) => ({ ...p, kind, amount: String(p.amount) }))
        : [{ ...form.prizes[index], kind }];
    patch({ prizes: form.prizes.flatMap((p, i) => (i === index ? split : [p])) });
  };

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const result = await saveFn({
        data: {
          ...scope,
          entry_fee_mxn: Number(form.entry_fee_mxn),
          prizes: parsedPrizes,
          pool_percent: usesCredit ? Number(form.pool_percent) : null,
          format: form.format.trim() || null,
          capacity: form.capacity ? Number(form.capacity) : null,
          registration_time: form.registration_time || null,
          notes: form.notes.trim() || null,
        },
      });
      toast.success(
        result.status === "pending"
          ? "Enviado a aprobación."
          : result.status === "details"
            ? "Datos guardados."
            : `Aprobado. Aplica a partir del ${result.effective_date}.`,
      );
      setForm(null);
      await refetch();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-white">Datos del torneo · toda la temporada</div>
        {data.pending ? (
          <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-yellow-400">
            Por aprobar
          </span>
        ) : data.upcoming ? (
          <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-300">
            Cambia el {data.upcoming.effective_date}
          </span>
        ) : data.current ? (
          <span className="rounded bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-400">
            Aprobados
          </span>
        ) : null}
      </div>
      {data.rejected && (
        <p className="text-xs text-red-300">Rechazado: {data.rejected.rejection_reason}</p>
      )}

      {!form ? (
        <div className="space-y-2">
          {data.current && data.pending && (
            <div className="text-xs text-gray-500">Vigente: {termsText(data.current)}</div>
          )}
          <div className="text-xs text-gray-300">
            {shown ? termsText(shown) : "Sin datos capturados todavía."}
          </div>
          <div className="flex justify-end">
            <button className={smallButton} onClick={() => setForm(formFrom(shown))}>
              {shown ? "Editar" : "Capturar datos"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={labelClass}>Costo en pesos (0 = gratis)</label>
              <input
                type="number"
                min={0}
                value={form.entry_fee_mxn}
                onChange={(e) => patch({ entry_fee_mxn: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Cupo</label>
              <input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => patch({ capacity: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Formato</label>
              <input
                value={form.format}
                maxLength={80}
                placeholder="Suizo, Bo1"
                onChange={(e) => patch({ format: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Registro desde</label>
              <input
                type="time"
                value={form.registration_time}
                onChange={(e) => patch({ registration_time: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Premios</label>
            {form.prizes.map((prize, i) => {
              const setPrize = (p: Partial<FichaForm["prizes"][number]>) =>
                patch({ prizes: form.prizes.map((x, j) => (j === i ? { ...x, ...p } : x)) });
              return (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_72px_28px] items-center gap-1.5 sm:grid-cols-[1fr_1.3fr_72px_28px]"
                >
                  <input
                    value={prize.place}
                    maxLength={40}
                    aria-label="Posición"
                    placeholder="1.º lugar, Participación"
                    onChange={(e) => setPrize({ place: e.target.value })}
                    className={`${inputClass} col-span-3 sm:col-span-1`}
                  />
                  <select
                    value={prize.kind}
                    aria-label="Tipo de premio"
                    onChange={(e) => changeKind(i, e.target.value as PrizeKind)}
                    className={inputClass}
                  >
                    {Object.entries(PRIZE_KINDS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={prize.amount}
                    max={prize.kind === "store_credit" ? 100 : undefined}
                    placeholder={prize.kind === "store_credit" ? "%" : undefined}
                    aria-label={prize.kind === "store_credit" ? "Porcentaje del pool" : "Cantidad"}
                    onChange={(e) => setPrize({ amount: e.target.value })}
                    className={inputClass}
                  />
                  <button
                    aria-label="Quitar premio"
                    className="text-gray-400 hover:text-red-300"
                    onClick={() => patch({ prizes: form.prizes.filter((_, j) => j !== i) })}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            {usesCredit && (
              <div className="space-y-1">
                <label className={labelClass}>% de las inscripciones que va al pool</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.pool_percent}
                  onChange={(e) => patch({ pool_percent: e.target.value })}
                  className={inputClass}
                />
              </div>
            )}
            {prizeHint && <p className="text-[11px] text-amber-300">{prizeHint}</p>}
            {form.prizes.length < 12 && (
              <button
                className={smallButton}
                onClick={() =>
                  patch({
                    prizes: [...form.prizes, { place: "", kind: "booster_pack", amount: "1" }],
                  })
                }
              >
                <Plus size={12} /> Agregar premio
              </button>
            )}
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Notas</label>
            <textarea
              value={form.notes}
              maxLength={500}
              rows={2}
              onChange={(e) => patch({ notes: e.target.value })}
              className={inputClass}
            />
          </div>
          <p className="text-[11px] text-gray-500">
            El costo y los premios aplican a toda la temporada. Un cambio ya aprobado entra en vigor
            {` ${MIN_NOTICE_DAYS}`} días después de que lo apruebe un Manager o Admin, y se avisa a
            los jugadores.
          </p>
          <div className="flex justify-end gap-2">
            <button className={smallButton} disabled={saving} onClick={() => setForm(null)}>
              Volver
            </button>
            <button
              disabled={saving || form.entry_fee_mxn === "" || Boolean(prizeHint)}
              onClick={save}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const FILTER_ALL = "";
const groupOf = (f: any) =>
  `${f.stores?.zone ?? "Sin zona"} · ${f.stores?.subzone ?? f.stores?.city ?? "Sin subzona"}`;

function sentAgo(date: string) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  return days === 0 ? "Enviado hoy" : days === 1 ? "Enviado ayer" : `Enviado hace ${days} días`;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel = "Todas",
}: {
  label: string;
  allLabel?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value={FILTER_ALL}>{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Moderación → Fichas de tienda: costo y premios por revisar, por zona. */
export function FichaReviewPage() {
  const listFn = useServerFn(listPendingFichas);
  const reviewFn = useServerFn(reviewFicha);
  const client = useQueryClient();
  const { data: fichas = [], isPending } = useQuery({
    queryKey: ["pending-fichas"],
    queryFn: () => listFn(),
  });
  const [zone, setZone] = useState(FILTER_ALL);
  const [store, setStore] = useState(FILTER_ALL);
  const [game, setGame] = useState(FILTER_ALL);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const unique = (values: (string | undefined)[]) =>
    Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort((a, b) =>
      a.localeCompare(b, "es-MX"),
    );
  const asOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }));
  const zones = asOptions(unique(fichas.map((f: any) => f.stores?.zone)));
  // Por id: dos zonas pueden tener tiendas con el mismo nombre.
  const stores = Array.from(
    new Map(
      fichas
        .filter((f: any) => !zone || f.stores?.zone === zone)
        .map((f: any) => [
          f.store_id as string,
          `${f.stores?.name ?? "—"}${zone ? "" : ` · ${f.stores?.zone ?? ""}`}`,
        ]),
    ),
    ([value, label]) => ({ value, label }),
  ).sort((a, b) => a.label.localeCompare(b.label, "es-MX"));
  const games = asOptions(unique(fichas.map((f: any) => f.games?.name)));
  // Si la tienda elegida ya no tiene pendientes, el filtro vuelve a Todas.
  const storeFilter = stores.some((o) => o.value === store) ? store : FILTER_ALL;
  const shown = fichas.filter(
    (f: any) =>
      (!zone || f.stores?.zone === zone) &&
      (!storeFilter || f.store_id === storeFilter) &&
      (!game || f.games?.name === game),
  );
  const groups = Array.from(
    shown.reduce((map: Map<string, any[]>, f: any) => {
      map.set(groupOf(f), [...(map.get(groupOf(f)) ?? []), f]);
      return map;
    }, new Map<string, any[]>()),
  ).sort(([a], [b]) => a.localeCompare(b, "es-MX"));

  async function review(ficha: any, approve: boolean) {
    setBusy(ficha.id);
    try {
      const result = await reviewFn({
        data: {
          id: ficha.id,
          updated_at: ficha.updated_at,
          approve,
          reason: approve ? undefined : reason.trim(),
        },
      });
      toast.success(
        approve ? `Aprobada. Aplica a partir del ${result.effective_date}.` : "Rechazada.",
      );
      setRejecting(null);
      setReason("");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
      client.invalidateQueries({ queryKey: ["pending-fichas"] });
      client.invalidateQueries({ queryKey: ["pending-fichas-count"] });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-primary">Moderación</div>
        <h1 className="mt-1 text-2xl font-bold text-white">Fichas de tienda</h1>
        <p className="mt-1 text-sm text-gray-400">
          Costo y premios de la temporada que enviaron los organizadores. Un cambio aprobado aplica{" "}
          {MIN_NOTICE_DAYS} días después y se avisa a los jugadores.
        </p>
      </div>

      {fichas.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <FilterSelect
            label="Zona"
            value={zone}
            options={zones}
            onChange={(v) => {
              setZone(v);
              setStore(FILTER_ALL);
            }}
          />
          <FilterSelect label="Tienda" value={storeFilter} options={stores} onChange={setStore} />
          <FilterSelect
            label="Juego"
            value={game}
            options={games}
            onChange={setGame}
            allLabel="Todos"
          />
        </div>
      )}

      {isPending ? (
        <Loader2 className="animate-spin text-primary" />
      ) : fichas.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-black/30 p-6 text-sm text-gray-400">
          No hay fichas por revisar.
        </p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-400">Ninguna ficha coincide con los filtros.</p>
      ) : (
        groups.map(([group, items]) => (
          <details key={group} open className="rounded-xl border border-white/10 bg-black/30">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold uppercase tracking-wider text-white">
              {group} <span className="text-gray-400">({items.length})</span>
            </summary>
            <div className="space-y-3 px-4 pb-4">
              {items.map((f: any) => {
                const changes = f.baseline ? describeFichaChanges(f.baseline, f) : [];
                return (
                  <div key={f.id} className="space-y-2 rounded-lg border border-white/10 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="text-sm font-semibold text-white">
                        {f.stores?.name} · {f.games?.name}
                      </div>
                      <div className="text-xs text-gray-400">{sentAgo(f.updated_at)}</div>
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-yellow-400">
                      {f.baseline
                        ? `Cambio: aplicaría el ${new Date(
                            `${addDays(todayInMexicoStr(), MIN_NOTICE_DAYS)}T12:00:00`,
                          ).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}`
                        : "Primeros datos: aplican al aprobarlos"}
                    </div>
                    {f.baseline ? (
                      <ul className="space-y-0.5 text-sm text-gray-200">
                        {changes.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-gray-200">{termsText(f)}</div>
                    )}
                    {rejecting === f.id ? (
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={reason}
                          maxLength={300}
                          placeholder="Motivo del rechazo"
                          onChange={(e) => setReason(e.target.value)}
                          className={`${inputClass} min-w-48 flex-1`}
                        />
                        <button
                          className={`${smallButton} text-red-300`}
                          disabled={busy === f.id || reason.trim().length < 3}
                          onClick={() => review(f, false)}
                        >
                          Rechazar
                        </button>
                        <button className={smallButton} onClick={() => setRejecting(null)}>
                          Volver
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button className={smallButton} onClick={() => setRejecting(f.id)}>
                          Rechazar
                        </button>
                        <button
                          disabled={busy === f.id}
                          onClick={() => review(f, true)}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
                        >
                          Aprobar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        ))
      )}
    </div>
  );
}

/** Contador de fichas pendientes para el menú de Moderación. */
export function usePendingFichasCount() {
  const countFn = useServerFn(countPendingFichas);
  const { data } = useQuery({
    queryKey: ["pending-fichas-count"],
    queryFn: () => countFn(),
    refetchInterval: 60_000,
  });
  return data?.count ?? 0;
}
