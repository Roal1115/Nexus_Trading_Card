import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [{ title: "Preguntas frecuentes — TCG League" }] }),
  component: FaqPage,
});

type Faq = { q: string; a: string[]; steps?: string[] };
type FaqSection = { title: string; items: Faq[] };

// Pegar aquí el enlace del reglamento cuando exista: el botón aparece solo.
const REGLAMENTO_URL: string | null = null;

const SECTIONS: FaqSection[] = [
  {
    title: "Primer torneo",
    items: [
      {
        q: "¿Cuándo empieza la temporada 2027?",
        a: [
          "La temporada regular de TCG League arranca el domingo 3 de enero de 2027. Consulta el calendario de la plataforma para conocer la fecha y hora del primer torneo en tu tienda.",
        ],
      },
      {
        q: "¿Cómo encuentro un torneo de TCG League?",
        a: [
          "Abre el calendario de la plataforma y busca una tienda participante en tu ciudad. En la ficha del evento revisa fecha, hora, formato, sede, inscripción y si el torneo otorga puntos de liga.",
        ],
      },
      {
        q: "¿Dónde veo cómo me fue?",
        a: [
          "Consulta el resultado publicado del evento y revisa tu posición en la Tabla Mensual y en la Tabla General.",
        ],
      },
      {
        q: "¿Qué pasa si un torneo se cancela antes de empezar?",
        a: ["El torneo no cuenta para la liga."],
      },
      {
        q: "¿Qué pasa si un torneo se cancela por causas externas después de empezar?",
        a: ["Los resultados se toman al cierre de la última ronda completada."],
      },
      {
        q: "¿Cuenta un torneo que cambia de sede?",
        a: ["Sí. Si el cambio de sede se avisa con anticipación, el torneo cuenta para la liga."],
      },
    ],
  },
  {
    title: "Puntos y tablas",
    items: [
      {
        q: "¿Cuántos puntos recibe quien gana un torneo?",
        a: [
          "El ganador de cada torneo válido de TCG League recibe 100 puntos. Es el máximo por torneo y se mantiene sin importar el número de participantes. Ganar un torneo de 8 jugadores o uno de 32 suma 100 puntos en ambos casos. A esto le llamamos puntuación normalizada.",
        ],
      },
      {
        q: "¿Cuántos puntos reciben las demás posiciones?",
        a: [
          "Puntos de liga = (puntos realizados por el jugador ÷ puntos máximos del torneo) × 100.",
          "Por ejemplo, si obtienes 12 de 15 puntos, sumas 80 puntos de liga. Si obtienes 15 de 15, sumas 100.",
        ],
      },
      {
        q: "¿Cómo clasifico por la Tabla Mensual?",
        a: [
          "Cada subregión tiene su propia Tabla Mensual. En cada una se suman tus dos mejores resultados de cada semana en torneos organizados por tiendas de esa subregión.",
          "En el Big Three, cada subregión otorga dos plazas al mes. Durante los cinco meses de temporada regular se asignan diez plazas por esta vía.",
        ],
      },
      {
        q: "¿Cómo clasifico por la Tabla General?",
        a: [
          "La Tabla General toma tus dos mejores resultados de cada semana en torneos válidos, sin importar en qué subregión jugaste. Tus dos mejores resultados pueden venir de subregiones distintas.",
          "En el Big Three, al cierre del quinto mes se asignan seis plazas por subregión a los jugadores de esa subregión mejor posicionados en la Tabla General que aún no hayan clasificado. Los 16 clasificados se ordenan según cuándo clasificaron: primero los de cada mes, en orden, y después los de la Tabla General, para distribuirlos en los grupos del Playoff Subregional.",
        ],
      },
      {
        q: "¿Qué hago si tengo dudas sobre mis puntos?",
        a: [
          "Habrá un correo de contacto de TCG League para consultas sobre puntos y reportes de posibles errores. La dirección oficial se anunciará en la plataforma. Al escribir, incluye tu nombre de jugador, la tienda, la fecha del torneo y el detalle de la duda.",
        ],
      },
      {
        q: "¿Cómo se resuelve un empate en puntos entre dos jugadores?",
        a: [
          "Primero se compara el OMW (porcentaje de victorias de tus oponentes). Si el empate sigue, queda arriba quien haya asistido a más torneos.",
        ],
      },
      {
        q: "¿Qué pasa si un jugador que ya clasificó vuelve a quedar en posición de ganar una plaza?",
        a: [
          "La plaza pasa al siguiente jugador de la tabla correspondiente que aún no haya clasificado.",
        ],
      },
    ],
  },
  {
    title: "Regiones y subregiones",
    items: [
      {
        q: "¿Cuáles son las regiones de TCG League?",
        a: [
          "Monterrey, CDMX, Guadalajara y Región Extendida. Las primeras tres forman el Big Three y cada una se divide en Norte, Sur, Este y Oeste.",
        ],
      },
      {
        q: "¿Cómo se organiza la Región Extendida?",
        a: [
          "Cada ciudad participante del resto del país con hasta cuatro tiendas forma una subregión. Consulta el directorio de la temporada para ver las ciudades y tiendas confirmadas.",
        ],
      },
      {
        q: "¿Dónde encuentro mi subregión?",
        a: [
          "Busca tu tienda en el directorio de la plataforma y revisa la región y subregión que aparecen en su ficha.",
        ],
      },
      {
        q: "¿Puedo jugar en otra subregión o ciudad?",
        a: [
          "Sí. Puedes jugar en cualquier tienda participante. Para la Tabla Mensual, cada resultado cuenta en la subregión de la tienda que organiza el torneo. Por ejemplo, si normalmente juegas en Monterrey Sur y compites en Monterrey Norte, ese resultado puede contar para la Tabla Mensual de Monterrey Norte y para la Tabla General si está entre tus dos mejores.",
        ],
      },
    ],
  },
  {
    title: "Playoffs y Torneo Nacional",
    items: [
      {
        q: "¿Qué pasa cuando clasifico en el Big Three?",
        a: [
          "Empiezas en el Playoff Subregional. Los 16 clasificados se distribuyen en cuatro grupos de cuatro. En tu grupo juegas contra los otros tres jugadores. Los dos mejores de cada grupo avanzan al Top 8 de eliminación directa.",
        ],
      },
      {
        q: "¿Dónde empiezan los playoffs de la Región Extendida?",
        a: [
          "En el Playoff de Ciudad. Consulta el reglamento de la temporada para ver las vías de clasificación y las plazas que corresponden a tu ciudad.",
        ],
      },
      {
        q: "¿Cómo llego al Torneo Nacional?",
        a: [
          "El Playoff de Ciudad se juega por eliminación directa y otorga plazas al Torneo Nacional. Si juegas en Monterrey Sur, tu ruta es Playoff Subregional de Monterrey Sur, Playoff de Ciudad de Monterrey y Torneo Nacional. Consulta los cupos oficiales de cada etapa en el reglamento.",
        ],
      },
      {
        q: "¿Qué pasa si clasifico en dos regiones?",
        a: [
          "Si ganas una plaza en dos subregiones, se asigna a aquella en la que tengas más puntos. Por ejemplo, si tienes 180 puntos en Monterrey Sur y 160 en Monterrey Norte, tu plaza se asigna a Monterrey Sur.",
        ],
      },
      {
        q: "¿Cómo se decide mi plaza si empato en dos subregiones?",
        a: ["Se comparan las subregiones en este orden:"],
        steps: [
          "Mayor puntaje en la subregión.",
          "Mejor OMW (porcentaje de victorias de tus oponentes) en la subregión.",
          "Mayor número de torneos a los que asististe en la subregión.",
          "Subregión donde jugaste tu primer torneo, entre las que sigan empatadas.",
          "Mayor cantidad de Legacy Points.",
        ],
      },
      {
        q: "¿Se usan los Legacy Points para desempatar en playoffs?",
        a: [
          "Sí. Si el empate entre jugadores persiste después de aplicar los criterios anteriores que correspondan, queda arriba quien tenga más Legacy Points. Este criterio aplica en el Playoff Subregional, el Playoff de Ciudad y el Torneo Nacional.",
        ],
      },
      {
        q: "¿Qué asistencia necesito para jugar mi playoff?",
        a: [
          "Además de clasificar, debes haber jugado al menos un torneo válido de liga en el 60% o más de las semanas de la temporada regular. Cada semana cuenta una sola vez, aunque juegues varios torneos. Si no cumples el mínimo, no podrás jugar tu playoff. Por ejemplo, si la temporada regular tiene 20 semanas, debes jugar en al menos 12 semanas distintas.",
        ],
      },
      {
        q: "¿Qué hago si clasifiqué y no puedo asistir al playoff?",
        a: [
          "Avisa a la tienda sede del playoff para que la plaza se pueda reasignar al siguiente jugador elegible.",
        ],
      },
    ],
  },
  {
    title: "Meta Analytics",
    items: [
      {
        q: "¿Para qué sirve Meta Analytics?",
        a: [
          "Te ayuda a preparar tu siguiente torneo con los datos disponibles. Si un líder de One Piece aparece seguido en los torneos recientes de tu zona, puedes priorizar ese enfrentamiento en tus prácticas.",
        ],
      },
      {
        q: "¿Cómo interpreto un porcentaje de victorias?",
        a: [
          "Léelo junto con el número de partidas y el periodo analizado. Un líder puede tener alta presencia y un porcentaje de victorias moderado. Si la muestra es pequeña, unas cuantas partidas pueden cambiar mucho el porcentaje.",
        ],
      },
      {
        q: "¿Cómo uso los datos para ajustar mi deck?",
        a: [
          "Identifica qué enfrentas con más frecuencia y, si hay datos de enfrentamientos, úsalos para elegir qué probar. Practica con tu lista antes y después del cambio para ver si te ayuda.",
        ],
      },
    ],
  },
  {
    title: "Premios y reconocimientos",
    items: [
      {
        q: "¿Dónde consulto los premios de un torneo?",
        a: [
          "En la ficha del evento, revisa la premiación anunciada y las condiciones para obtenerla. Para reconocimientos de temporada y premios de playoffs, consulta el anuncio oficial de la etapa correspondiente.",
        ],
      },
      {
        q: "¿Qué diferencia hay entre un premio y una plaza?",
        a: [
          "Una plaza te permite avanzar a otra etapa de la competencia. Un premio es una recompensa anunciada para un torneo o etapa. Consulta qué ofrece cada evento y cómo se obtiene.",
        ],
      },
    ],
  },
];

function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        eyebrow="Temporada 2027"
        title="Preguntas frecuentes"
        actions={
          REGLAMENTO_URL && (
            <a
              href={REGLAMENTO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-primary/40 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              Ver reglamento
            </a>
          )
        }
      />
      <div className="space-y-5">
        {SECTIONS.map((section) => (
          <section key={section.title} className="glass rounded-2xl p-5">
            <h2 className="mb-1 text-lg font-bold text-foreground">{section.title}</h2>
            <Accordion type="multiple">
              {section.items.map((item) => (
                <AccordionItem key={item.q} value={item.q}>
                  <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                  <AccordionContent className="space-y-2 text-foreground-secondary">
                    {item.a.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    {item.steps && (
                      <ol className="list-decimal space-y-1 pl-5">
                        {item.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>
    </main>
  );
}
