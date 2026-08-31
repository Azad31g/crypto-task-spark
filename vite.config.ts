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
const bufferPolyfill = require.resolve("buffer/");


export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        // @reown/appkit ships Lit web components that touch HTMLElement at
        // module scope. Even though the app only imports them from the
        // browser-only `appkit-runtime` chunk, the SSR/worker bundle groups
        // them with `wagmi`, so the Cloudflare worker evaluated Lit on every
        // request and crashed with "HTMLElement is not defined" (HTTP 500).
        // AppKit is never executed on the server, so resolve it to an inert
        // stub in non-client environments; the client bundle is untouched.
        name: "azox-appkit-ssr-stub",
        enforce: "pre" as const,
        resolveId(this: { environment?: { name?: string } }, id: string) {
          if (this.environment?.name === "client") return null;
          // @metamask/connect-evm is browser-only too (mobile wallet protocol,
          // WebRTC/DOM globals) and is only reachable through the lazy,
          // client-only appkit-runtime chunk.
          if (/^@metamask\/connect-evm(\/|$)/.test(id))
            return "\0azox-appkit-ssr-stub";
          if (!/^@reown\/appkit(-adapter-wagmi)?(\/|$)/.test(id)) return null;
          if (id.startsWith("@reown/appkit/networks")) return null;
          return "\0azox-appkit-ssr-stub";
        },

        load(id: string) {
          if (id !== "\0azox-appkit-ssr-stub") return null;
          return `const notAvailable = () => { throw new Error("@reown/appkit is browser-only and must not run on the server"); };
export const WagmiAdapter = notAvailable;
export const createAppKit = notAvailable;
export const AppKitButton = notAvailable;
export const createEVMClient = notAvailable;
export default new Proxy({}, { get: () => notAvailable });`;
        },
      },
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
      {
        // Same class of problem for "node:buffer": MetaMask Connect's mobile
        // wallet protocol uses Buffer for its session encryption, and the
        // browser bundle would otherwise externalize it to an empty stub.
        name: "azox-buffer-browser-polyfill",
        enforce: "pre" as const,
        resolveId(this: { environment?: { name?: string } }, id: string) {
          if (id !== "buffer" && id !== "node:buffer") return null;
          if (this.environment?.name !== "client") return null;
          return bufferPolyfill;
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

