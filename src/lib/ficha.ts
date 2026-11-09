export const PRIZE_KINDS = {
  tournament_pack: "Tournament Packs",
  booster_pack: "Booster Packs",
  store_credit: "Crédito de tienda",
} as const;

export type PrizeKind = keyof typeof PRIZE_KINDS;
/** amount: piezas de producto o, en crédito de tienda, porcentaje del pool. */
export type Prize = { place: string; kind: PrizeKind; amount: number };

export const DEFAULT_CREDIT_SPLIT = [
  { place: "1.º lugar", amount: 50 },
  { place: "2.º lugar", amount: 30 },
  { place: "3.º lugar", amount: 20 },
];

/** Porcentaje del pool repartido; no puede pasar de 100. */
export const creditPercentTotal = (prizes: { kind: string; amount: number }[]) =>
  prizes.filter((p) => p.kind === "store_credit").reduce((sum, p) => sum + p.amount, 0);

export const CANCEL_REASONS = ["Sin luz en el local", "Clima", "Enfermedad del organizador"];

export function prizeText(prize: Prize): string {
  return prize.kind === "store_credit"
    ? `${prize.amount}% del pool en crédito de tienda`
    : `${prize.amount} ${PRIZE_KINDS[prize.kind]}`;
}

/** Días entre aprobar un cambio de costo o premios y que entre en vigor. */
export const MIN_NOTICE_DAYS = 14;

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type CommercialTerms = { entry_fee_mxn: number; prizes: Prize[]; pool_percent: number | null };

/** Cuenta para volver a aprobar: costo, premios y pool, sin importar el orden de las llaves. */
export function sameCommercialTerms(a: CommercialTerms, b: CommercialTerms): boolean {
  const terms = (x: CommercialTerms) =>
    JSON.stringify([
      x.entry_fee_mxn,
      x.pool_percent ?? null,
      x.prizes.map((p) => [p.place, p.kind, p.amount]),
    ]);
  return terms(a) === terms(b);
}

const money = (fee: number) => (fee === 0 ? "Gratis" : `$${fee} MXN`);

/** Solo lo que cambia entre dos versiones, en frases para el jugador. */
export function describeFichaChanges(current: CommercialTerms, next: CommercialTerms): string[] {
  const lines: string[] = [];
  if (current.entry_fee_mxn !== next.entry_fee_mxn) {
    lines.push(`Costo: de ${money(current.entry_fee_mxn)} a ${money(next.entry_fee_mxn)}`);
  }
  const before = new Map(current.prizes.map((p) => [p.place, p]));
  for (const prize of next.prizes) {
    const old = before.get(prize.place);
    if (!old) lines.push(`Se agrega ${prize.place}: ${prizeText(prize)}`);
    else if (prizeText(old) !== prizeText(prize)) {
      lines.push(`${prize.place}: de ${prizeText(old)} a ${prizeText(prize)}`);
    }
    before.delete(prize.place);
  }
  for (const place of before.keys()) lines.push(`Se quita ${place}`);
  if ((current.pool_percent ?? null) !== (next.pool_percent ?? null)) {
    lines.push(
      next.pool_percent
        ? `El pool será el ${next.pool_percent}% de las inscripciones`
        : "Ya no hay pool de inscripciones",
    );
  }
  return lines;
}

/** Versión vigente hoy y el próximo cambio ya aprobado. Fechas YYYY-MM-DD. */
export function pickFichaVersions<
  T extends { status: string; effective_date: string | null; created_at: string },
>(versions: T[], today: string): { current: T | null; upcoming: T | null } {
  const approved = versions
    .filter((v) => v.status === "approved")
    .sort(
      (a, b) =>
        b.effective_date!.localeCompare(a.effective_date!) ||
        b.created_at.localeCompare(a.created_at),
    );
  return {
    current: approved.find((v) => v.effective_date! <= today) ?? null,
    upcoming: approved.find((v) => v.effective_date! > today) ?? null,
  };
}
