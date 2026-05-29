import { Alert, AlertDescription } from "@bullstudio/ui/components/alert";
import { Button } from "@bullstudio/ui/components/button";
import { Input } from "@bullstudio/ui/components/input";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, LockKeyhole } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { z } from "zod";
import {
  getAssetUrl,
  getAuthUrl,
  getBasePath,
  getDashboardIdentity,
} from "@/lib/runtime-config";

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

interface AuthSessionResponse {
  authEnabled?: boolean;
  authenticated?: boolean;
}

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  component: LoginRoute,
});

function LoginRoute() {
  const search = Route.useSearch();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
  const usernameId = useId();
  const passwordId = useId();
  const dashboardIdentity = getDashboardIdentity();
  const dashboardLogo = dashboardIdentity?.logo;
  const dashboardTitle = dashboardIdentity?.title ?? "bullstudio";

  useEffect(() => {
    let cancelled = false;

    fetch(getAuthUrl("/api/auth/session"), {
      credentials: "same-origin",
    })
      .then((response) => response.json())
      .then((session: AuthSessionResponse) => {
        if (cancelled) {
          return;
        }

        setAuthEnabled(session.authEnabled ?? true);

        if (!session.authEnabled || session.authenticated) {
          navigateAfterLogin(search.redirect);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthEnabled(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [search.redirect]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(getAuthUrl("/api/auth/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        setError("Username or password is incorrect.");
        return;
      }

      navigateAfterLogin(search.redirect);
    } catch {
      setError("Login failed. Check the server and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authEnabled === null || authEnabled === false) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <img
            src={dashboardLogo?.src ?? getAssetUrl("/logo.svg")}
            alt={dashboardLogo?.alt ?? "bullstudio"}
            className="size-9"
          />
          <div>
            <h1 className="font-semibold text-lg leading-tight">
              {dashboardTitle}
            </h1>
            <p className="text-muted-foreground text-xs uppercase">
              Dashboard login
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-md border border-border bg-card p-5 shadow-sm"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LockKeyhole className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Sign in</h2>
              <p className="text-muted-foreground text-sm">
                Use your Bullstudio credentials.
              </p>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <label className="block space-y-2" htmlFor={usernameId}>
              <span className="font-medium text-sm">Username</span>
              <Input
                autoComplete="username"
                autoFocus
                id={usernameId}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label className="block space-y-2" htmlFor={passwordId}>
              <span className="font-medium text-sm">Password</span>
              <Input
                autoComplete="current-password"
                id={passwordId}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </div>

          <Button
            type="submit"
            className="mt-6 w-full"
            disabled={isSubmitting || !username || !password}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}

function navigateAfterLogin(redirect: string | undefined): void {
  const safeRedirect =
    redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
  window.location.assign(`${getBasePath()}${safeRedirect}`);
}
