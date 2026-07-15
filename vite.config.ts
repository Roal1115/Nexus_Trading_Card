// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        // ponytail: lovable config hardcodes injectSource:true with no option;
        // strip the plugin post-resolve to kill data-tsd-source hydration noise
        name: "disable-tsd-inject-source",
        configResolved(config) {
          const i = config.plugins.findIndex(
            (p) => p.name === "@tanstack/devtools:inject-source",
          );
          if (i !== -1) (config.plugins as unknown[]).splice(i, 1);
        },
      },
    ],
  },
});
