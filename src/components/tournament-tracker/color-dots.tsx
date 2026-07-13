const COLOR_HEX: Record<string, string> = {
  Red: "#ef4444",
  Blue: "#3b82f6",
  Green: "#22c55e",
  Purple: "#a855f7",
  Black: "#374151",
  Yellow: "#eab308",
};

export function ColorDots({ colors }: { colors: string[] | null }) {
  if (!colors || colors.length === 0) return null;
  return (
    <span className="ml-2 inline-flex flex-shrink-0 items-center gap-0.5">
      {colors.map((c, i) => (
        <span
          key={`${c}-${i}`}
          className="h-2 w-2 rounded-full border border-white/20"
          style={{ backgroundColor: COLOR_HEX[c] ?? "#666" }}
        />
      ))}
    </span>
  );
}
