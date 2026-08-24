import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Sentinel para "sin filtro": Radix Select no permite value="" en un Item,
// así que la opción de limpiar se modela como un ítem real seleccionable.
const NONE = "__none__";

// Select de bloque completo (ancho 100%, mismo look que los inputs de fecha
// vecinos) para filtros tipo formulario. Mismos primitives de Radix que
// PillSelect, solo cambia el skin del trigger. El placeholder es también
// una opción del menú (igual que el <option value=""> original) para poder
// volver a "sin filtro" sin salir del dropdown.
export function BlockSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className="h-auto w-full rounded-lg border-white/10 bg-white/[0.03] py-2 pl-3 pr-3 text-sm shadow-none focus:border-primary focus:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
