import { Link } from "@tanstack/react-router";
import { CalendarDays, Check, ChevronRight, MapPin, Swords } from "lucide-react";

const stepClass =
  "group flex items-center gap-3 rounded-xl border border-border bg-card/60 p-4 transition hover:border-primary/40";

function StepText({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function StepIcon({ done, children }: { done?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      {done ? <Check size={18} /> : children}
    </div>
  );
}

const arrow = (
  <ChevronRight
    size={16}
    className="flex-shrink-0 text-muted-foreground transition group-hover:text-primary"
  />
);

/** Primer paso útil para quien aún no tiene torneos: reemplaza el Inicio vacío. */
export function NewPlayerSteps({ zone }: { zone: string | null }) {
  return (
    <section className="mb-6" aria-labelledby="new-player-title">
      <h2 id="new-player-title" className="text-lg font-semibold text-foreground">
        Empieza aquí
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">Tres pasos para empezar a competir.</p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Link to="/settings" className={stepClass}>
          <StepIcon done={!!zone}>
            <MapPin size={18} />
          </StepIcon>
          <StepText
            title={zone ? `Tu zona: ${zone}` : "1. Elige tu zona"}
            body={
              zone ? "Puedes cambiarla en Configuración." : "El calendario se abrirá en tu zona."
            }
          />
          {arrow}
        </Link>
        <Link to="/calendar" className={stepClass}>
          <StepIcon>
            <CalendarDays size={18} />
          </StepIcon>
          <StepText
            title="2. Busca un torneo"
            body="Marca tu preferencia en un horario. Tu inscripción oficial sigue en la app de Bandai."
          />
          {arrow}
        </Link>
        <Link to="/sessions" className={stepClass}>
          <StepIcon>
            <Swords size={18} />
          </StepIcon>
          <StepText
            title="3. Registra tus partidas"
            body="Anota tus rondas de torneos y prácticas. Tus puntos llegan cuando la tienda sube el torneo."
          />
          {arrow}
        </Link>
      </div>
    </section>
  );
}
