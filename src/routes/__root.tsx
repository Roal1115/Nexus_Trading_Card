import {
  Outlet,
  Link,
  createRootRoute,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { GeekarenaAuthProvider } from "../context/geekarena-auth.context";
import appCss from "../styles.css?url";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PanelBottomNav } from "@/components/layout/PanelBottomNav";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

const CHUNK_RELOAD_KEY = "__chunk_reload_at__";

function isChunkLoadError(error: unknown): boolean {
  const msg = (error as any)?.message ?? String(error ?? "");
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg)
  );
}

if (typeof window !== "undefined") {
  const tryReload = (err: unknown) => {
    if (!isChunkLoadError(err)) return;
    try {
      const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? "0");
      if (Date.now() - last < 10_000) return;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };
  window.addEventListener("error", (e) => tryReload((e as ErrorEvent).error ?? e.message));
  window.addEventListener("unhandledrejection", (e) =>
    tryReload((e as PromiseRejectionEvent).reason),
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  if (typeof window !== "undefined" && isChunkLoadError(error)) {
    try {
      const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? "0");
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Geek Arena" },
      { name: "description", content: "yes" },
      { name: "author", content: "Geek Arena" },
      { property: "og:title", content: "Geek Arena" },
      { property: "og:description", content: "yes" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Geek Arena" },
      { name: "twitter:description", content: "yes" },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/252cadab-9e57-4dbf-9803-6170b38644e3/id-preview-b760d1ac--7816e8a3-9d96-43db-a57a-25bf43a687c9.lovable.app-1781539732674.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/252cadab-9e57-4dbf-9803-6170b38644e3/id-preview-b760d1ac--7816e8a3-9d96-43db-a57a-25bf43a687c9.lovable.app-1781539732674.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Geek Arena",
          url: "https://mxntcg.lovable.app",
          logo: "https://mxntcg.lovable.app/favicon.ico",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Geek Arena",
          url: "https://mxntcg.lovable.app",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://mxntcg.lovable.app/players/{search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPanel =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/organizer") ||
    pathname.startsWith("/tcg-manager");

  return (
    <GeekarenaAuthProvider>
      <div className="min-h-dvh bg-radial-nexus">
        {!isPanel && <AppHeader />}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1e2130",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#ffffff",
            },
          }}
        />
        <BottomNav />
        <PanelBottomNav />
      </div>
    </GeekarenaAuthProvider>
  );
}
