import { Area, type AreaProps } from "recharts";

// Área de "jugadores por semana" (inicio y estadísticas). Es una función y no un componente
// porque recharts 2 solo reconoce sus hijos directos: ni componentes propios ni fragmentos.
// Relleno plano, sin gradiente (The Flat Content Rule), en azul neutro.
export function attendanceArea(props?: Omit<AreaProps, "ref" | "dataKey">) {
  return (
    <Area
      type="monotone"
      dataKey="players"
      stroke="#8fb4ff"
      strokeWidth={2}
      fill="#8fb4ff"
      fillOpacity={0.15}
      {...props}
    />
  );
}
