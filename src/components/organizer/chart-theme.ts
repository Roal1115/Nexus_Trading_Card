// Colores y estilo compartido de las gráficas del organizer. Recharts recibe props de JS y no
// clases de Tailwind, así que aquí viven una sola vez. Verde/rojo quedan fuera: son solo de
// resultado de match (The Result Colors Rule), y estos datos no son resultados.
export const CHART = {
  primary: "#8fb4ff", // jugadores únicos (misma serie que player-status y attendanceArea)
  muted: "#aab6d1", // medida secundaria: asistencias totales, recurrentes (= "Ocasional" en player-status)
  warning: "var(--warning)", // bajas: mismo significado que "Por recuperar"
  axis: "var(--foreground-secondary)",
  grid: "var(--border)",
};

export const AXIS = { stroke: CHART.axis, fontSize: 12, tick: { fill: CHART.axis } };

export const TOOLTIP = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--foreground)",
    padding: "8px 12px",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: "var(--foreground-secondary)" },
};
