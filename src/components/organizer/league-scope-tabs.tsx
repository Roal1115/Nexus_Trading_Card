import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const NATIONAL = "__national__";

export function LeagueScopeTabs({
  availableLeagues,
  value,
  onChange,
}: {
  availableLeagues: Array<{ id: string; name: string }>;
  value: string | null;
  onChange: (leagueId: string | null) => void;
}) {
  if (availableLeagues.length === 0) return null;
  return (
    <Tabs
      value={value ?? NATIONAL}
      onValueChange={(v) => onChange(v === NATIONAL ? null : v)}
    >
      <TabsList className="flex h-auto flex-wrap">
        <TabsTrigger value={NATIONAL}>Circuito Nacional</TabsTrigger>
        {availableLeagues.map((l) => (
          <TabsTrigger key={l.id} value={l.id}>
            {l.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
