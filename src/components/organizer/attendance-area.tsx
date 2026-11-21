import { Area, type AreaProps } from "recharts";
import { CHART } from "./chart-theme";

// Área de "jugadores por semana" (inicio y estadísticas). Es una función y no un componente
// porque recharts 2 solo reconoce sus hijos directos: ni componentes propios ni fragmentos.
// Relleno plano, sin gradiente (The Flat Content Rule), en azul neutro.
export function attendanceArea(props?: Omit<AreaProps, "ref" | "dataKey">) {
  return (
    <Area
      type="monotone"
      dataKey="players"
      stroke={CHART.primary}
      strokeWidth={2}
      fill={CHART.primary}
      fillOpacity={0.15}
      {...props}
    />
  );
}
