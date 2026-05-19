import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { TopNav } from "@/components/TopNav";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-0)]">
      <div className="text-center">
        <div className="num text-6xl text-[var(--text-primary)]">404</div>
        <div className="mt-2 text-xs uppercase tracking-wider text-[var(--text-secondary)]">
          Route not found
        </div>
        <a href="/" className="mt-4 inline-block text-xs text-[var(--cyan)] hover:underline">
          ← Back to dashboard
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-0)]">
      <div className="max-w-md rounded border border-[var(--border)] bg-[var(--bg-1)] p-6">
        <div className="text-sm text-[var(--text-primary)]">Something broke loading this page.</div>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          You can retry, or head back to the dashboard.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded bg-[var(--cyan)] px-3 py-1 text-xs font-medium text-black hover:bg-[var(--cyan)]/85"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded bg-[var(--bg-2)] px-3 py-1 text-xs text-[var(--text-primary)] ring-1 ring-[var(--border)] hover:bg-[var(--bg-0)]"
          >
            Back to dashboard
          </a>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails((s) => !s)}
          className="mt-4 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        >
          {showDetails ? "Hide" : "Show"} technical details
        </button>
        {showDetails && (
          <pre className="mt-2 max-h-48 overflow-auto rounded bg-[var(--bg-0)] p-2 font-mono text-[10px] text-[var(--text-tertiary)]">
            {error.message}
            {error.stack && "\n\n"}
            {error.stack}
          </pre>
        )}
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CongressTrade Intelligence" },
      {
        name: "description",
        content: "Internal: signals from US government officials' stock trades.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
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
      <body className="bg-[var(--bg-0)] text-[var(--text-primary)] antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-[var(--bg-0)]">
        <TopNav />
        <main className="mx-auto max-w-[1600px] px-4 py-4">
          <Outlet />
        </main>
        <Toaster theme="dark" position="bottom-right" />
      </div>
    </QueryClientProvider>
  );
}
