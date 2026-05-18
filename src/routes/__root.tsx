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
          ← back to dashboard
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-0)]">
      <div className="max-w-md rounded border border-[var(--border)] bg-[var(--bg-1)] p-6">
        <div className="text-xs uppercase tracking-wider text-[var(--negative)]">runtime error</div>
        <div className="mt-2 font-mono text-xs text-[var(--text-secondary)]">{error.message}</div>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 rounded bg-[var(--bg-2)] px-3 py-1 text-xs text-[var(--text-primary)] hover:bg-[var(--border)]"
        >
          retry
        </button>
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
