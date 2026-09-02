import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/docs/features")({
  head: () => ({ meta: [{ title: "Features — Nexus" }] }),
  component: FeaturesDocsPage,
});

type Role = "organizer" | "manager" | "admin" | "player";

const ROLE_STYLES: Record<Role, { dot: string; text: string; bg: string; label: string }> = {
  organizer: { dot: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/10", label: "Organizador" },
  manager: { dot: "bg-blue-500", text: "text-blue-500", bg: "bg-blue-500/10", label: "TCG Manager" },
  admin: { dot: "bg-purple-500", text: "text-purple-500", bg: "bg-purple-500/10", label: "Admin" },
  player: { dot: "bg-amber-500", text: "text-amber-500", bg: "bg-amber-500/10", label: "Jugador" },
};

type Feature = { title: string; desc: string; fn?: string };
type Group = { title: string; features: Feature[] };
type RoleSection = { role: Role; title: string; sub: string; groups: Group[] };

const ROLE_SECTIONS: RoleSection[] = [
  {
    role: "organizer",
    title: "Organizador de tienda",
    sub: "Dueño o encargado de una tienda local. Corre sus propios torneos, arma ligas de temporada y gestiona su comunidad de jugadores sin depender de nadie más.",
    groups: [
      {
        title: "Torneos",
        features: [
          { title: "Alta de torneos y borradores", desc: "Crear eventos y descartar borradores sin publicar.", fn: "createTournament · deleteDraftTournament" },
          { title: "Carga de resultados y emparejamientos", desc: "Subir el resultado final del evento.", fn: "uploadTournamentResults" },
          { title: "Historial con filtros avanzados", desc: "Revisar eventos pasados por juego, fecha o liga.", fn: "getOrganizerTournamentHistory" },
        ],
      },
      {
        title: "Ligas de temporada",
        features: [
          { title: "Creación, edición y archivado de ligas", desc: "Armar una liga y cerrarla al terminar temporada.", fn: "createStoreLeague" },
          { title: "Asignación de torneos a una liga", desc: "Decidir qué eventos cuentan para la liga." },
          { title: "Premios y calendario con excepciones puntuales", desc: "Definir premios y mover una fecha sin romper el calendario recurrente.", fn: "setLeaguePrizes · upsertLeagueScheduleOverride" },
        ],
      },
      {
        title: "Comunidad y tienda",
        features: [
          { title: "Búsqueda y verificación de tags de jugador", desc: "Confirmar identidad antes de asociar resultados.", fn: "lookupPlayerTags" },
          { title: "Edición de ficha de tienda y sede", desc: "Datos de contacto, ubicación y redes." },
          { title: "Resolución de apelaciones de resultados", desc: "Atender disputas de un jugador sobre un resultado." },
        ],
      },
      {
        title: "Panel y analítica",
        features: [
          { title: "Calendario propio de eventos", desc: "Vista de todo lo programado en la tienda." },
          { title: "Contadores de pendientes en tiempo real", desc: "Badges de lo que falta por resolver." },
          { title: "Analítica de asistencia y desempeño de la tienda", desc: "Tendencias de participación por periodo." },
          { title: "Meta de líderes jugados en su tienda", desc: "Alimentado automáticamente por cada torneo cargado, sin captura extra.", fn: "getMetaStats" },
        ],
      },
    ],
  },
  {
    role: "manager",
    title: "TCG Manager",
    sub: "Supervisa varias tiendas dentro de un juego o territorio. Es el filtro de calidad entre lo que un organizador sube y lo que llega al ranking oficial.",
    groups: [
      {
        title: "Aprobación de torneos",
        features: [
          { title: "Cola de pendientes y aprobados por separado", desc: "Nada llega al ranking sin pasar por aquí.", fn: "getManagerPendingTournaments" },
          { title: "Aprobar, rechazar o revertir con un clic", desc: "Incluye deshacer una aprobación previa.", fn: "managerApproveTournament · managerUndoApproval" },
          { title: "Publicar, despublicar y republicar resultados", desc: "Control total sobre visibilidad pública del evento.", fn: "managerRepublishTournament" },
        ],
      },
      {
        title: "Cobertura multi-tienda",
        features: [
          { title: "Lista de tiendas bajo su responsabilidad", desc: "Un manager puede cubrir varias tiendas a la vez.", fn: "getManagerResponsibleStores" },
          { title: "Asignación de juegos por manager", desc: "Un manager puede especializarse en un TCG.", fn: "assignManagerGames" },
          { title: "Carga de resultados a nombre de una tienda", desc: "Soporte cuando el organizador no puede subir el evento." },
        ],
      },
      {
        title: "Calendario y horarios",
        features: [
          { title: "Vista de calendario de todas sus tiendas", desc: "Un solo lugar para ver toda su cobertura." },
          { title: "Excepciones de horario por tienda", desc: "Ajustar un horario recurrente para una fecha puntual.", fn: "upsertScheduleOverride" },
          { title: "Historial personal de acciones tomadas", desc: "Trazabilidad de lo que aprobó o rechazó." },
        ],
      },
      {
        title: "Analítica territorial",
        features: [
          { title: "Panorama general con tendencias", desc: "Salud del territorio de un vistazo.", fn: "getManagerAnalyticsOverview" },
          { title: "Gráficas de evolución por periodo", desc: "Comparar meses o temporadas.", fn: "getManagerAnalyticsTrend" },
          { title: "Badges de pendientes por revisar", desc: "Nada se queda esperando sin avisar." },
        ],
      },
    ],
  },
  {
    role: "admin",
    title: "Administrador",
    sub: "Control total de la plataforma: da de alta tiendas y staff, modera el circuito completo y sostiene el calendario y las temporadas a nivel nacional.",
    groups: [
      {
        title: "Tiendas y staff",
        features: [
          { title: "Alta, edición y activación de tiendas", desc: "Ciclo de vida completo de una tienda en la plataforma.", fn: "createStore · setStoreActive" },
          { title: "Asignación de organizador a cada tienda", desc: "Quién queda a cargo de operar la tienda." },
          { title: "Alta y baja de miembros de staff", desc: "Gestión de cuentas internas.", fn: "upsertStaffMember" },
        ],
      },
      {
        title: "Jugadores",
        features: [
          { title: "Listado global con activar/desactivar", desc: "Visibilidad de toda la base de jugadores.", fn: "listPlayers · setPlayerActive" },
          { title: "Cambio de rol de cuenta", desc: "Promover a organizador, manager o admin.", fn: "setPlayerRole" },
          { title: "Eliminación de cuenta bajo solicitud", desc: "Cumplimiento de solicitudes de baja." },
        ],
      },
      {
        title: "Moderación del circuito",
        features: [
          { title: "Aprobar / rechazar con motivo", desc: "El rechazo siempre queda documentado.", fn: "rejectTournamentWithReason" },
          { title: "Publicar, despublicar y republicar en bloque", desc: "Operar sobre varios torneos a la vez.", fn: "publishTournaments" },
          { title: "Carga masiva de resultados", desc: "Para migraciones o eventos grandes." },
        ],
      },
      {
        title: "Plataforma",
        features: [
          { title: "Calendario nacional unificado", desc: "Todo el circuito en una sola vista." },
          { title: "Gestión de temporadas y anuncios", desc: "Definir cortes de temporada para ranking y premios.", fn: "getSeasonsList" },
          { title: "Bitácora de actividad y auditoría", desc: "Quién hizo qué y cuándo." },
        ],
      },
    ],
  },
  {
    role: "player",
    title: "Jugador",
    sub: "La experiencia final del circuito: historial, ranking, perfil público y una forma de registrar partidas incluso fuera de torneos oficiales.",
    groups: [
      {
        title: "Perfil y progreso",
        features: [
          { title: "Dashboard personal con resumen de actividad", desc: "Lo más relevante al entrar.", fn: "getMyDashboard" },
          { title: "Perfil público por tag y por temporada", desc: "Compartible, con corte histórico por temporada.", fn: "getPublicProfile · getSeasonProfile" },
          { title: "Control de privacidad del perfil", desc: "El jugador decide qué se ve públicamente." },
        ],
      },
      {
        title: "Estadísticas y ranking",
        features: [
          { title: "Stats generales, por juego y casuales", desc: "Historial completo, no solo lo oficial.", fn: "getMyStats · getMyStatsGames" },
          { title: "Leaderboard con filtros por juego y zona", desc: "Ranking segmentado, no una sola tabla global.", fn: "getLeaderboard" },
          { title: "Resultados pendientes de aprobación", desc: "Transparencia sobre qué todavía no cuenta oficialmente." },
        ],
      },
      {
        title: "Torneos y asistencia",
        features: [
          { title: "Confirmar o cancelar asistencia (RSVP)", desc: "Da visibilidad de cupo al organizador.", fn: "createRsvp · cancelRsvp" },
          { title: "Historial de torneos jugados", desc: "Registro completo de participación." },
          { title: "Tiendas favoritas", desc: "Seguimiento rápido de las tiendas que frecuenta." },
        ],
      },
      {
        title: "Performance tracker",
        features: [
          { title: "Registrar sesiones y rondas fuera del sistema oficial", desc: "Práctica o casual, sin esperar a un torneo.", fn: "createStandaloneSession · saveStandaloneRound" },
          { title: "Detección del torneo oficial correspondiente", desc: "El sistema sugiere el match cruzando juego, fecha y sede — sin que el jugador lo busque.", fn: "getTournamentCandidates" },
          { title: "Confirmar o revertir el vínculo", desc: "Un clic migra las rondas casuales a resultado oficial; también se puede deshacer.", fn: "linkSessionManually · undoSessionLink" },
        ],
      },
    ],
  },
];

const PUBLIC_PAGES = [
  { title: "Directorio de tiendas", desc: "Listado y perfil público de cada tienda participante." },
  { title: "Horario semanal", desc: "Eventos recurrentes y liga activa de cada tienda." },
  { title: "Calendario nacional", desc: "Todos los torneos publicados del circuito, en un solo lugar." },
  { title: "Detalle de torneo", desc: "Resultados, tabla de posiciones y ficha del evento." },
];

const FLOW_STEPS = [
  { n: "01", title: "El jugador ya trae su tracker", desc: "Antes del torneo, o en la mesa, registra sus rondas en el performance tracker personal — líder jugado, resultado, turno.", fn: "standalone_sessions · standalone_round_results" },
  { n: "02", title: "La tienda sube el torneo oficial", desc: "El organizador carga los resultados del evento como siempre — no necesita saber quién traía su tracker corriendo.", fn: "uploadTournamentResults" },
  { n: "03", title: "Detección automática de coincidencia", desc: "El sistema cruza juego, fecha y sede contra las sesiones sin vincular del jugador y le sugiere el torneo correcto.", fn: "getTournamentCandidates" },
  { n: "04", title: "Un clic y sus rondas quedan oficiales", desc: "Al confirmar, las rondas casuales se migran a resultado oficial de torneo — listas para stats y ranking.", fn: "linkSessionManually" },
];

const FAQ = [
  {
    q: "¿Es multi-tenant? ¿Cada tienda ve solo lo suyo?",
    a: "Sí. Organizador y TCG Manager operan con visibilidad acotada a su(s) tienda(s) vía Supabase/RLS; Admin es el único rol con vista global del circuito.",
  },
  {
    q: "¿Cómo se evita que una tienda publique resultados sin revisión?",
    a: "Todo torneo pasa por una cola de aprobación antes de publicarse: el organizador lo sube, un TCG Manager lo aprueba o rechaza, y de ahí puede publicarse, despublicarse o republicarse.",
  },
  {
    q: "¿El performance tracker requiere vincular manualmente cada vez?",
    a: "El sistema sugiere el torneo correcto automáticamente cruzando juego, fecha y sede — el jugador solo confirma con un clic. No hay búsqueda manual, pero sí una confirmación explícita antes de que sus rondas casuales pasen a contar como oficiales.",
  },
  {
    q: "¿De dónde sale el meta de una tienda?",
    a: "De las mismas rondas que ya se cargan al aprobar un torneo — no hay captura extra. Se agrupan variantes de arte alterno del mismo líder para no fragmentar la muestra.",
  },
  {
    q: "¿Qué tan atado está esto a un solo juego?",
    a: "Nada en el modelo de datos asume un TCG específico — juego es un filtro más (games, leaders, deck_identifiers), no una tabla hardcodeada.",
  },
];

function RoleNavPill({ role }: { role: Role }) {
  const s = ROLE_STYLES[role];
  return (
    <a
      href={`#${role}`}
      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </a>
  );
}

function FeatureCard({ feature, role }: { feature: Feature; role: Role }) {
  const s = ROLE_STYLES[role];
  return (
    <li className="text-sm leading-relaxed">
      <span className="flex items-start gap-2">
        <span className={cn("mt-1.5 h-1 w-1 shrink-0 rounded-full", s.dot)} />
        <span>
          <span className="font-medium text-foreground">{feature.title}</span>
          <span className="block text-muted-foreground">{feature.desc}</span>
          {feature.fn ? (
            <code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {feature.fn}
            </code>
          ) : null}
        </span>
      </span>
    </li>
  );
}

function FeaturesDocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* HERO */}
        <div className="border-b border-border pb-10">
          <div className="mb-4 flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary">
            <span className="h-px w-5 bg-primary" />
            Nexus · documentación de funcionalidades
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Todo lo que Nexus hace hoy, por rol.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Torneos, ligas, calendario nacional, aprobaciones, performance tracker y meta — inventario vivo de lo que
            ya está construido en la plataforma.
          </p>
        </div>

        {/* ROLE NAV */}
        <div className="sticky top-0 z-10 -mx-6 flex flex-wrap gap-2 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          {(["organizer", "manager", "admin", "player"] as Role[]).map((r) => (
            <RoleNavPill key={r} role={r} />
          ))}
          <a
            href="#tracker"
            className="inline-flex items-center gap-2 rounded-full border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Tracker &amp; Meta
          </a>
          <a
            href="#faq"
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            FAQ
          </a>
        </div>

        {/* ROLE SECTIONS */}
        {ROLE_SECTIONS.map((section, i) => {
          const s = ROLE_STYLES[section.role];
          return (
            <section
              key={section.role}
              id={section.role}
              className="scroll-mt-24 border-b border-border py-12"
            >
              <div className="mb-2 flex flex-wrap items-baseline gap-3">
                <Badge className={cn("border-transparent font-mono text-[11px] uppercase tracking-wide", s.bg, s.text)}>
                  Rol {String(i + 1).padStart(2, "0")}
                </Badge>
                <h2 className="text-2xl font-semibold">{section.title}</h2>
              </div>
              <p className="mb-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">{section.sub}</p>
              <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
                {section.groups.map((group) => (
                  <div key={group.title} className="bg-card p-5">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                      {group.title}
                    </h3>
                    <ul className="space-y-3">
                      {group.features.map((f) => (
                        <FeatureCard key={f.title} feature={f} role={section.role} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* TRACKER / META ENGINE */}
        <section id="tracker" className="scroll-mt-24 border-b border-border py-12">
          <div className="mb-2 flex flex-wrap items-baseline gap-3">
            <Badge className="border-transparent bg-primary/10 font-mono text-[11px] uppercase tracking-wide text-primary">
              Motor de datos
            </Badge>
            <h2 className="text-2xl font-semibold">Del resultado de una ronda al meta de la tienda</h2>
          </div>
          <p className="mb-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Cada ronda que se juega, oficial o casual, alimenta el mismo motor. Así es como una carga de resultados en
            la tienda termina convertida en estadística personal y en metagame público, sin captura doble.
          </p>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW_STEPS.map((step) => (
              <div key={step.n} className="rounded-lg border border-border bg-card p-4">
                <div className="font-mono text-xs text-primary">{step.n}</div>
                <h4 className="mt-1 text-sm font-semibold">{step.title}</h4>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
                <code className="mt-3 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {step.fn}
                </code>
              </div>
            ))}
          </div>

          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            <div className="bg-card p-5">
              <h3 className="mb-2 text-sm font-semibold">My Stats — el jugador</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Win rate por líder, por matchup, por turno inicial. Combina rondas oficiales y casuales en un solo
                historial personal, con lo pendiente de aprobar marcado aparte.
              </p>
              <code className="mt-3 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                getMyStats · getMyStatsGames
              </code>
            </div>
            <div className="bg-card p-5">
              <h3 className="mb-2 text-sm font-semibold">Meta — la tienda y el circuito</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Win rate y play rate por líder, matriz de matchups entre los líderes top, filtrable por tienda, zona,
                juego y temporada. Los alt-art de un mismo líder se agrupan para no partir la muestra.
              </p>
              <code className="mt-3 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                getMetaStats · getMetaMatchups
              </code>
            </div>
          </div>
        </section>

        {/* PUBLIC */}
        <section className="border-b border-border py-12">
          <h2 className="mb-2 text-xl font-semibold">+ Páginas públicas, sin necesidad de cuenta</h2>
          <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
            Todo lo que un visitante ve antes de registrarse — el escaparate del circuito.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PUBLIC_PAGES.map((p) => (
              <div key={p.title} className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm font-semibold">{p.title}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* SUMMARY STRIP */}
        <section className="border-b border-border py-10">
          <h2 className="max-w-xl text-2xl font-semibold text-balance">El esqueleto ya está construido.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Cuatro roles, moderación en cascada tienda → manager → admin, calendario nacional, perfiles públicos y un
            motor de stats/meta compartido — la base sobre la que se empaqueta como producto.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["multi-tenant por tienda", "Supabase / Postgres", "roles y permisos nativos", "calendario + temporadas"].map(
              (b) => (
                <span
                  key={b}
                  className="rounded-full border border-border px-3 py-1 font-mono text-[11px] text-muted-foreground"
                >
                  {b}
                </span>
              ),
            )}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 py-12">
          <h2 className="mb-4 text-xl font-semibold">Preguntas frecuentes</h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent className="max-w-2xl text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <footer className="py-8 font-mono text-xs text-muted-foreground">
          Nexus — documentación interna de funcionalidades, compartida por link.
        </footer>
      </div>
    </div>
  );
}
