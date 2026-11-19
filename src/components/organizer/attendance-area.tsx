import { Area, type AreaProps } from "recharts";

// Área naranja de "jugadores por semana" (inicio y estadísticas). Es una función y no un
// componente porque recharts solo reconoce sus hijos directos (los fragmentos sí se aplanan).
export function attendanceArea(gradientId: string, props?: Omit<AreaProps, "ref" | "dataKey">) {
  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
          <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
        </linearGradient>
      </defs>
      <Area
        type="monotone"
        dataKey="players"
        stroke="#f97316"
        strokeWidth={2}
        fill={`url(#${gradientId})`}
        {...props}
      />
    </>
  );
}
