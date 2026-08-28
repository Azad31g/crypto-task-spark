
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRoute,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AzoxProvider } from "../components/azox/app-provider";
import { TopBar } from "../components/azox/top-bar";
import { BottomNav } from "../components/azox/bottom-nav";
import { BoxAlertBanner } from "../components/azox/box-alert-banner";
import { Toaster } from "../components/ui/sonner";
import { WagmiProvider } from "wagmi";
import { ClientOnly } from "@tanstack/react-router";
import { getSsrWagmiConfig } from "../lib/wagmi-config";
import { lazy, Suspense } from "react";


// Browser-only AppKit + WagmiAdapter provider (see appkit-runtime.tsx).
// The dynamic chunk can fail transiently (dev re-optimization, flaky network),
// so retry a few times. It must NEVER fall back to the connector-free SSR
// config in the browser: that would silently present a permanently
// disconnected wallet. A hard failure surfaces the real error instead.
async function loadAppKitProvider() {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const m = await import("../lib/appkit-runtime");
      return { default: m.AppKitWagmiProvider };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  console.error("AppKit runtime failed to load", lastError);
  throw lastError instanceof Error
    ? lastError
    : new Error("AppKit runtime failed to load");
}

// Start the browser-only chunk as early as possible so the client mounts the
// AppKit wagmi config on (or right after) the first client render instead of
// lingering on a second, read-only config.
const appKitProviderPromise =
  typeof window !== "undefined" ? loadAppKitProvider() : null;

if (appKitProviderPromise) {
  // The lazy() consumer surfaces the failure; this only avoids an unhandled
  // rejection warning before React gets to it.
  appKitProviderPromise.catch(() => {});
}

const AppKitWagmiProvider = lazy(
  () => appKitProviderPromise ?? loadAppKitProvider(),
);




const queryClient = new QueryClient();



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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

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
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      },
      { title: "AZOX — Tap to Earn Mini App" },
      {
        name: "description",
        content:
          "AZOX gaming mini app: tap to earn points, play mini games and climb 7 global ranks.",
      },
      { name: "author", content: "Guardex Quant LABs" },
      { name: "theme-color", content: "#000000" },
      { property: "og:title", content: "AZOX — Tap to Earn Mini App" },
      {
        property: "og:description",
        content: "Tap to earn AZOX points and climb 7 global ranks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" />
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
  return (
    <QueryClientProvider client={queryClient}>
      {/* The read-only wagmi config exists ONLY for the server render (it has
          no connectors and never reconnects). In the browser the AppKit chunk
          is preloaded at module scope, so the single live client wagmi context
          is the AppKit adapter one; the Suspense fallback deliberately renders
          no wagmi provider, so no second client config can mount underneath
          connected state. */}
      <ClientOnly
        fallback={
          <WagmiProvider config={getSsrWagmiConfig()}>
            <AppContent />
          </WagmiProvider>
        }
      >
        <Suspense fallback={null}>
          <AppKitWagmiProvider>
            <AppContent />
          </AppKitWagmiProvider>
        </Suspense>
      </ClientOnly>
    </QueryClientProvider>
  );
}

function AppContent() {
  return (
    <AzoxProvider>
      <div className="min-h-screen bg-background text-foreground">
        <BoxAlertBanner />
        <TopBar />
        <main className="mx-auto w-full max-w-md px-4 pb-28 pt-4">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </main>
        <BottomNav />
        <Toaster />
      </div>
    </AzoxProvider>
  );
}
