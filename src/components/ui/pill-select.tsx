import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Select estilo "pill" (label + valor) usado en los filtros del leaderboard.
// Envuelve los primitives de Radix ya instalados (@radix-ui/react-select) en
// vez de un dropdown custom: teclado, ARIA y posicionamiento correctos gratis;
// solo se re-skinnea el trigger. Plano, borde de sistema, label en 12px sin
// mayúsculas (DESIGN.md: The No Kicker Rule) y 44px de alto en móvil.
export function PillSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className="h-auto min-h-11 w-auto gap-2 rounded-md border-border bg-transparent px-3 py-1.5 text-sm shadow-none transition hover:bg-white/5 focus:ring-primary/50 md:min-h-9 data-[state=open]:[&>svg]:rotate-180 [&>svg]:opacity-100 [&>svg]:text-foreground-subtle [&>svg]:transition-transform [&>svg]:duration-200"
      >
        <span className="text-xs text-foreground-subtle">{label}</span>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
