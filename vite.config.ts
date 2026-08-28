// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const require = createRequire(import.meta.url);
const eventsPolyfill = require.resolve("events/");


export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        // Vite/Rolldown treats the bare specifier "events" as a Node builtin and
        // stubs it with __vite-browser-external ({}) in the browser bundle, ahead
        // of resolve.alias. WalletConnect's `import EventEmitter from "events"`
        // then yields undefined and `new EventEmitter()` throws
        // "default is not a constructor", which aborts UniversalProvider.init()
        // and leaves AppKit without its walletConnect connector
        // ("WalletConnectConnector not found"). Resolve it to the real npm
        // `events` polyfill in the client bundle only; the server keeps the
        // native Node builtin.
        name: "azox-events-browser-polyfill",
        enforce: "pre" as const,
        resolveId(this: { environment?: { name?: string } }, id: string) {
          if (id !== "events" && id !== "node:events") return null;
          if (this.environment?.name !== "client") return null;
          return eventsPolyfill;
        },
      },
    ],
    resolve: {
      // NOTE: must stay an object map. The shared Lovable config already sets
      // `resolve.alias` as an object ({ "@": ... }); passing an array here makes
      // mergeConfig produce a malformed array alias list that Vite ignores.
      alias: {
        // The published "exports" map resolves to the CJS build in the production
        // bundle, where `new UniversalProvider()` fails. Force the ESM build.
        "@walletconnect/universal-provider": fileURLToPath(
          new URL(
            "./node_modules/@walletconnect/universal-provider/dist/index.js",
            import.meta.url,
          ),
        ),
      },
    },
  },
});

