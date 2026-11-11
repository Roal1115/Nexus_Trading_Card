import { useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import locations from "@/data/mx-locations.json";
import {
  CLOSED_WEEK,
  formatWeekHours,
  isValidWeek,
  parseWeekHours,
  TIME_OPTIONS,
  WEEK_LABELS,
  type DayHours,
  type WeekHours,
} from "@/lib/store-hours";

export const storeFieldClass =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary aria-[invalid=true]:border-red-400";

// Sin esto, buscar "Mexico" no encontraría "México".
const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function SearchSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={`${storeFieldClass} flex items-center justify-between text-left disabled:opacity-50`}
        >
          <span className={value ? "" : "text-muted-foreground"}>{value || placeholder}</span>
          <ChevronsUpDown size={14} className="ml-2 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command filter={(item, search) => (plain(item).includes(plain(search)) ? 1 : 0)}>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <Check
                    size={14}
                    className={`mr-2 ${value === option ? "opacity-100" : "opacity-0"}`}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TimeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={storeFieldClass}
    >
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

function DayButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-md border px-1 text-xs font-semibold transition sm:min-h-9 ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

type Hours = NonNullable<DayHours>;
const DEFAULT_HOURS: Hours = { open: "12:00", close: "20:00" };

function mostCommonHours(week: WeekHours): Hours {
  const counts = new Map<string, { hours: Hours; n: number }>();
  for (const day of week) {
    if (!day) continue;
    const key = `${day.open}-${day.close}`;
    counts.set(key, { hours: day, n: (counts.get(key)?.n ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.hours ?? DEFAULT_HOURS;
}

/** Días abiertos, horario general y excepciones por día. `initial` solo se lee al montar. */
export function WeekHoursPicker({
  initial,
  onChange,
}: {
  initial: WeekHours;
  onChange: (week: WeekHours) => void;
}) {
  const [days, setDays] = useState(() => initial.map(Boolean));
  const [general, setGeneral] = useState(() => mostCommonHours(initial));
  const [specials, setSpecials] = useState<Record<number, Hours>>(() => {
    const base = mostCommonHours(initial);
    return Object.fromEntries(
      initial.flatMap((d, i) =>
        d && (d.open !== base.open || d.close !== base.close) ? [[i, d]] : [],
      ),
    );
  });

  const emit = (nextDays: boolean[], nextGeneral: Hours, nextSpecials: Record<number, Hours>) => {
    setDays(nextDays);
    setGeneral(nextGeneral);
    setSpecials(nextSpecials);
    onChange(nextDays.map((on, i) => (on ? (nextSpecials[i] ?? nextGeneral) : null)));
  };

  const toggleDay = (i: number) => {
    const { [i]: _removed, ...rest } = specials;
    emit(
      days.map((on, d) => (d === i ? !on : on)),
      general,
      rest,
    );
  };

  const withoutSpecial = days.flatMap((on, i) => (on && !specials[i] ? [i] : []));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1">
        {WEEK_LABELS.map((label, i) => (
          <DayButton key={label} label={label} active={days[i]} onClick={() => toggleDay(i)} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-xs text-foreground/70">Abre</span>
          <TimeSelect
            label="Hora de apertura"
            value={general.open}
            onChange={(open) => emit(days, { ...general, open }, specials)}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-foreground/70">Cierra</span>
          <TimeSelect
            label="Hora de cierre"
            value={general.close}
            onChange={(close) => emit(days, { ...general, close }, specials)}
          />
        </div>
      </div>

      {Object.entries(specials).map(([key, hours]) => {
        const i = Number(key);
        return (
          <div key={key} className="grid grid-cols-[3rem_1fr_1fr_auto] items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{WEEK_LABELS[i]}</span>
            <TimeSelect
              label={`Apertura especial ${WEEK_LABELS[i]}`}
              value={hours.open}
              onChange={(open) => emit(days, general, { ...specials, [i]: { ...hours, open } })}
            />
            <TimeSelect
              label={`Cierre especial ${WEEK_LABELS[i]}`}
              value={hours.close}
              onChange={(close) => emit(days, general, { ...specials, [i]: { ...hours, close } })}
            />
            <button
              type="button"
              aria-label={`Quitar horario especial ${WEEK_LABELS[i]}`}
              onClick={() => {
                const { [i]: _removed, ...rest } = specials;
                emit(days, general, rest);
              }}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      {withoutSpecial.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Plus size={12} /> Horario especial:
          </span>
          {withoutSpecial.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => emit(days, general, { ...specials, [i]: general })}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {WEEK_LABELS[i]}
            </button>
          ))}
        </div>
      )}

      {days.some(Boolean) && (
        <p aria-live="polite" className="text-xs font-medium text-primary">
          {formatWeekHours(days.map((on, i) => (on ? (specials[i] ?? general) : null)))}
        </p>
      )}
    </div>
  );
}

const catalog = locations as Record<string, string[]>;

/** Estado y Ciudad del catálogo de INEGI. Cambiar de estado limpia la ciudad. */
export function LocationSelects({
  state,
  city,
  onChange,
}: {
  state: string;
  city: string;
  onChange: (next: { state: string; city: string }) => void;
}) {
  return (
    <>
      <SearchSelect
        label="Estado"
        options={Object.keys(catalog)}
        value={state}
        placeholder="Busca el estado"
        onChange={(next) => onChange({ state: next, city: "" })}
      />
      <SearchSelect
        label="Ciudad"
        options={catalog[state] ?? []}
        value={city}
        placeholder="Busca la ciudad"
        disabled={!catalog[state]}
        onChange={(next) => onChange({ state, city: next })}
      />
    </>
  );
}

/** Para editar: si nadie toca el control, el texto guardado no cambia. */
export function OpeningHoursField({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string, valid: boolean) => void;
}) {
  const [parsed] = useState(() => parseWeekHours(value));
  return (
    <div className="space-y-2">
      {!parsed && value.trim() && (
        <p className="text-xs text-muted-foreground">
          Horario actual: {value}. Si cambias algo aquí, este texto se reemplaza por completo.
        </p>
      )}
      <WeekHoursPicker
        initial={parsed ?? CLOSED_WEEK}
        onChange={(week) => onChange(formatWeekHours(week), isValidWeek(week))}
      />
    </div>
  );
}
