import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Select estilo "pill" (label uppercase + valor) usado en filtros de
// leaderboard/meta. Envuelve los primitives de Radix ya instalados
// (@radix-ui/react-select) en vez de un dropdown custom: teclado, ARIA y
// posicionamiento correctos gratis; solo se re-skinnea el trigger para
// mantener el look existente del filtro.
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
      <SelectTrigger className="h-auto w-auto gap-2 rounded-md border-white/10 bg-white/5 px-3 py-1.5 text-xs shadow-none transition hover:border-white/20 focus:ring-primary/50 data-[state=open]:[&>svg]:rotate-180 [&>svg]:opacity-100 [&>svg]:text-gray-500 [&>svg]:transition-transform [&>svg]:duration-200">
        <span className="uppercase tracking-wider text-gray-500">{label}</span>
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
