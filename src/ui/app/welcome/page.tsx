"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface CompletionPayload {
  ownerName: string;
  workspaceName: string;
  hireName: string;
  roleName: string;
  usedGoogle: boolean;
  fromOAuthCallback: boolean;
}

const ONBOARDING_COMPLETE_KEY = "ai_employee_onboarding_complete";

export default function WelcomePage() {
  const router = useRouter();
  const [payload, setPayload] = useState<CompletionPayload | null>(null);
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    const raw = sessionStorage.getItem(ONBOARDING_COMPLETE_KEY);
    if (!raw) {
      router.replace("/dashboard");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as CompletionPayload;
      setPayload(parsed);
    } catch {
      router.replace("/dashboard");
      return;
    }

    const countdownTimer = window.setInterval(() => {
      setSeconds(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    const redirectTimer = window.setTimeout(() => {
      sessionStorage.removeItem(ONBOARDING_COMPLETE_KEY);
      router.replace("/dashboard");
    }, 5000);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(redirectTimer);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background p-8">
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 22 }).map((_, i) => (
          <motion.span
            key={i}
            className={`absolute h-2 w-2 rounded-full ${
              i % 3 === 0
                ? "bg-primary/90"
                : i % 3 === 1
                ? "bg-secondary/90"
                : "bg-accent/90"
            }`}
            initial={{
              x: `${(i * 43) % 100}%`,
              y: "-10%",
              opacity: 0,
              scale: 0.8,
            }}
            animate={{
              y: "110%",
              opacity: [0, 1, 1, 0.3, 0],
              rotate: [0, 120, 260, 360],
              scale: [0.8, 1, 1, 0.6],
            }}
            transition={{
              duration: 3 + (i % 5),
              repeat: Infinity,
              delay: (i % 7) * 0.2,
              ease: "easeIn",
            }}
          />
        ))}
      </div>

      <div className="relative mx-auto flex min-h-[85vh] max-w-3xl items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full rounded-3xl border border-border bg-card/80 p-10 text-center backdrop-blur"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-primary">
            Hire Complete
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight">
            Welcome to {payload?.workspaceName ?? "your workspace"}.
          </h1>
          <p className="mt-3 text-lg text-muted">
            {payload?.hireName ?? "Your new teammate"} ({payload?.roleName ?? "AI teammate"}) is
            live and ready to work.
          </p>

          <div className="mx-auto mt-8 max-w-lg space-y-3 rounded-2xl border border-border bg-background/50 p-5 text-left text-sm">
            <p>
              Great job, <span className="font-semibold">{payload?.ownerName ?? "there"}</span>.
            </p>
            <p>
              Account setup method:{" "}
              <span className="font-semibold">
                {payload?.usedGoogle ? "Google OAuth" : "Email + Password"}
              </span>
            </p>
            <p>
              Redirecting to dashboard in{" "}
              <span className="font-semibold">{seconds}s</span>.
            </p>
          </div>

          <button
            onClick={() => {
              sessionStorage.removeItem(ONBOARDING_COMPLETE_KEY);
              router.replace("/dashboard");
            }}
            className="mt-8 rounded-xl bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            Enter Dashboard Now
          </button>
        </motion.div>
      </div>
    </main>
  );
}

