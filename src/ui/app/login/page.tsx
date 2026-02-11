"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";

interface AgentsResponse {
  agents?: unknown[];
}

interface ProvidersResponse {
  google?: unknown;
}

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const routedAfterAuthRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const oauthError = useMemo(() => {
    const value = queryError;
    if (!value) {
      return null;
    }
    if (value === "OAuthSignin" || value === "OAuthCallback") {
      return "Google sign-in failed. Check your OAuth credentials and callback URL.";
    }
    return "Could not complete sign-in. Please try again.";
  }, [queryError]);

  const routeAfterLogin = async () => {
    const response = await fetch("/api/agents", { cache: "no-store" });
    const data = (await response.json()) as AgentsResponse;
    const hasAgents = Array.isArray(data.agents) && data.agents.length > 0;
    router.replace(hasAgents ? "/dashboard" : "/hire");
  };

  useEffect(() => {
    const stored = localStorage.getItem("ai_employee_user_email");
    if (stored) {
      setEmail(stored);
    }

    const params = new URLSearchParams(window.location.search);
    setQueryError(params.get("error"));
  }, []);

  useEffect(() => {
    async function loadProviders() {
      try {
        const response = await fetch("/api/auth/providers", { cache: "no-store" });
        const data = (await response.json()) as ProvidersResponse;
        setGoogleAvailable(Boolean(data.google));
      } catch {
        setGoogleAvailable(false);
      }
    }

    loadProviders();
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || routedAfterAuthRef.current) {
      return;
    }
    routedAfterAuthRef.current = true;
    void routeAfterLogin();
  }, [status]);

  const handleCredentialsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoadingCredentials(true);
    try {
      if (rememberMe) {
        localStorage.setItem("ai_employee_user_email", email);
      } else {
        localStorage.removeItem("ai_employee_user_email");
      }

      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setError("Invalid credentials. Check email/password and try again.");
        return;
      }

      await routeAfterLogin();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Login failed. Please try again."
      );
    } finally {
      setLoadingCredentials(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoadingGoogle(true);
    await signIn("google", { callbackUrl: "/login?oauth=google" });
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-6 py-10 md:px-10">
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pointer-events-none absolute inset-0"
      >
        <motion.div
          className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
          animate={{ x: [0, 30, -10, 0], y: [0, 20, -15, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-accent/20 blur-3xl"
          animate={{ x: [0, -25, 10, 0], y: [0, -15, 25, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="relative mx-auto flex min-h-[85vh] max-w-6xl items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="grid w-full overflow-hidden rounded-3xl border border-border bg-card/80 backdrop-blur md:grid-cols-2"
        >
          <div className="hidden border-r border-border p-10 md:flex md:flex-col md:justify-between">
            <div className="space-y-5">
              <Link
                href="/"
                className="inline-flex items-center text-sm text-muted hover:text-foreground"
              >
                {"<-"} Back home
              </Link>
              <div>
                <p className="mb-2 text-sm uppercase tracking-[0.2em] text-primary">
                  Returning user
                </p>
                <h1 className="text-4xl font-bold leading-tight">
                  Welcome back to your AI team.
                </h1>
              </div>
              <p className="max-w-md text-sm text-muted">
                Sign in with Google or your workspace credentials to continue.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background/60 p-5">
              <p className="text-xs uppercase tracking-wider text-muted">
                Single deployment tip
              </p>
              <p className="mt-2 text-sm text-foreground/90">
                You can lock credentials with `APP_LOGIN_PASSWORD` and
                `APP_LOGIN_ALLOWED_EMAILS` in root `.env`.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <div className="mb-8 flex items-center justify-between md:hidden">
              <Link href="/" className="text-sm text-muted hover:text-foreground">
                {"<-"} Back
              </Link>
              <span className="text-xs uppercase tracking-[0.2em] text-primary">
                Login
              </span>
            </div>

            <div className="mb-6 space-y-2">
              <h2 className="text-3xl font-bold">Sign in</h2>
              <p className="text-sm text-muted">
                Continue with Google or use your email and password.
              </p>
            </div>

            <div className="mb-5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={!googleAvailable || loadingGoogle || loadingCredentials}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingGoogle ? "Redirecting to Google..." : "Continue with Google"}
              </button>
              {!googleAvailable ? (
                <p className="mt-2 text-xs text-muted">
                  Google OAuth is not configured yet. Add `GOOGLE_CLIENT_ID` and
                  `GOOGLE_CLIENT_SECRET` in `.env`.
                </p>
              ) : null}
            </div>

            <div className="mb-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-[0.15em] text-muted">
                or
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleCredentialsSubmit} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground/90"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none transition focus:border-primary"
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground/90"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none transition focus:border-primary"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
              </div>

              <label className="flex items-center gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-border bg-background text-primary"
                />
                Remember my email on this device
              </label>

              {oauthError ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  {oauthError}
                </p>
              ) : null}

              {error ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loadingCredentials || loadingGoogle}
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-primary to-secondary px-5 py-3 font-semibold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="relative z-10">
                  {loadingCredentials ? "Signing in..." : "Sign in with password"}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-secondary to-accent opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
