"use client";

import { motion } from "framer-motion";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

interface Resume {
  id: string;
  name: string;
  backgroundName: string;
  backgroundDescription: string;
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    highlights: string[];
  }>;
  skills: string[];
  personality: string[];
  workingStyle: string;
}

interface PendingHire {
  roleSlug: string;
  resume: Resume;
  capturedAt: string;
}

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  typingSpeedMs?: number;
}

interface SavedOnboardingState {
  roleSlug: string;
  resumeId: string;
  messages: ChatMessage[];
  step: Step;
  name: string;
  email: string;
  workspaceName: string;
  googleAuthChoice: boolean | null;
}

type Step =
  | "name"
  | "email"
  | "google-choice"
  | "google-wait"
  | "workspace"
  | "launch-ready";

const PENDING_HIRE_KEY = "ai_employee_pending_hire";
const ONBOARDING_STATE_KEY = "ai_employee_onboarding_state";
const ONBOARDING_COMPLETE_KEY = "ai_employee_onboarding_complete";

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toRoleName(slug: string) {
  return slug
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function TypewriterText({
  text,
  speedMs = 16,
}: {
  text: string;
  speedMs?: number;
}) {
  const [visibleText, setVisibleText] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let index = 0;
    setVisibleText("");
    setDone(false);

    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(text.slice(0, index));
      if (index >= text.length) {
        setDone(true);
        window.clearInterval(timer);
      }
    }, speedMs);

    return () => window.clearInterval(timer);
  }, [speedMs, text]);

  return (
    <span>
      {visibleText}
      <span
        className={`ml-0.5 inline-block w-[7px] align-middle ${
          done ? "opacity-0" : "animate-pulse opacity-100"
        }`}
      >
        |
      </span>
    </span>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { status } = useSession();

  const initializedRef = useRef(false);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const assistantQueueRef = useRef(Promise.resolve());
  const oauthHandledRef = useRef(false);

  const [pendingHire, setPendingHire] = useState<PendingHire | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState<Step>("name");
  const [inputValue, setInputValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [googleAuthChoice, setGoogleAuthChoice] = useState<boolean | null>(
    null
  );
  const [oauthFlag, setOauthFlag] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const roleName = useMemo(() => {
    if (!pendingHire) {
      return "AI teammate";
    }
    return toRoleName(pendingHire.roleSlug);
  }, [pendingHire]);

  const appendMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };

  const appendUserMessage = (text: string) => {
    appendMessage({ id: makeId(), role: "user", text });
  };

  const enqueueAssistantMessage = (
    text: string,
    options?: { delayMs?: number; typingSpeedMs?: number }
  ) => {
    const delayMs = options?.delayMs ?? 280;
    const typingSpeedMs = options?.typingSpeedMs ?? 16;

    assistantQueueRef.current = assistantQueueRef.current.then(async () => {
      setAssistantTyping(true);
      await sleep(delayMs);
      appendMessage({
        id: makeId(),
        role: "assistant",
        text,
        typingSpeedMs,
      });
      const estimatedTypingTime = Math.min(
        3200,
        Math.max(700, text.length * typingSpeedMs + 300)
      );
      await sleep(estimatedTypingTime);
      setAssistantTyping(false);
    });

    return assistantQueueRef.current;
  };

  useEffect(() => {
    if (!pendingHire) {
      return;
    }

    const stateToSave: SavedOnboardingState = {
      roleSlug: pendingHire.roleSlug,
      resumeId: pendingHire.resume.id,
      messages,
      step,
      name,
      email,
      workspaceName,
      googleAuthChoice,
    };

    sessionStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(stateToSave));
  }, [pendingHire, messages, step, name, email, workspaceName, googleAuthChoice]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    setOauthFlag(params.get("oauth"));

    const rawPending = sessionStorage.getItem(PENDING_HIRE_KEY);
    if (!rawPending) {
      setLoadError("No pending hire found. Choose a candidate first.");
      return;
    }

    try {
      const parsedPending = JSON.parse(rawPending) as PendingHire;
      if (!parsedPending.roleSlug || !parsedPending.resume?.id) {
        throw new Error("Pending hire data is incomplete.");
      }
      setPendingHire(parsedPending);

      const rawSavedState = sessionStorage.getItem(ONBOARDING_STATE_KEY);
      if (rawSavedState) {
        const saved = JSON.parse(rawSavedState) as SavedOnboardingState;
        if (
          saved.roleSlug === parsedPending.roleSlug &&
          saved.resumeId === parsedPending.resume.id
        ) {
          setMessages(saved.messages ?? []);
          setStep(saved.step ?? "name");
          setName(saved.name ?? "");
          setEmail(saved.email ?? "");
          setWorkspaceName(saved.workspaceName ?? "");
          setGoogleAuthChoice(saved.googleAuthChoice ?? null);
          return;
        }
      }

      void enqueueAssistantMessage(
        `Hi, I am ${parsedPending.resume.name}, your new ${toRoleName(
          parsedPending.roleSlug
        )}. What should I call you?`,
        { delayMs: 450, typingSpeedMs: 14 }
      );
    } catch (error) {
      console.error("Failed to parse onboarding state:", error);
      setLoadError("We could not restore your hire session. Please start again.");
    }
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, assistantTyping]);

  useEffect(() => {
    if (step !== "google-wait") {
      oauthHandledRef.current = false;
      return;
    }

    if (status !== "authenticated" || oauthHandledRef.current) {
      return;
    }

    oauthHandledRef.current = true;
    void (async () => {
      await enqueueAssistantMessage(
        "Google account connected. Nice and clean.",
        { typingSpeedMs: 14 }
      );
      await enqueueAssistantMessage(
        "Last step: what should we call your workspace?",
        { typingSpeedMs: 14 }
      );
      setStep("workspace");
    })();
  }, [status, step]);

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const value = inputValue.trim();
    if (!value) {
      setFormError("Please enter a response.");
      return;
    }

    if (step === "name") {
      setName(value);
      appendUserMessage(value);
      setInputValue("");
      await enqueueAssistantMessage(
        `Great to meet you, ${value}. Excited to get to work. First, let's set up your account. What is your email?`,
        { typingSpeedMs: 14 }
      );
      setStep("email");
      return;
    }

    if (step === "email") {
      if (!value.includes("@") || !value.includes(".")) {
        setFormError("Enter a valid email address.");
        return;
      }

      setEmail(value);
      appendUserMessage(value);
      setInputValue("");

      if (value.toLowerCase().endsWith("@gmail.com")) {
        await enqueueAssistantMessage(
          "Looks like a Gmail address. Would you like to sign in with your Google account?",
          { typingSpeedMs: 14 }
        );
        setStep("google-choice");
      } else {
        await enqueueAssistantMessage(
          "Perfect. One more thing: what should we call your workspace?",
          { typingSpeedMs: 14 }
        );
        setStep("workspace");
      }
      return;
    }

    if (step === "workspace") {
      if (value.length < 2) {
        setFormError("Workspace name should be at least 2 characters.");
        return;
      }

      setWorkspaceName(value);
      appendUserMessage(value);
      setInputValue("");
      await enqueueAssistantMessage(
        `Amazing. Setup is complete. When you are ready, I will join ${value} and start delivering immediately.`,
        { typingSpeedMs: 14 }
      );
      setStep("launch-ready");
    }
  };

  const handleGoogleChoice = async (useGoogle: boolean) => {
    setFormError(null);
    setGoogleAuthChoice(useGoogle);
    appendUserMessage(
      useGoogle ? "Yes, sign in with Google" : "No, continue manually"
    );

    if (!useGoogle) {
      await enqueueAssistantMessage(
        "No problem. We will keep your account on email and password."
      );
      await enqueueAssistantMessage(
        "Last step: what should we call your workspace?"
      );
      setStep("workspace");
      return;
    }

    if (status === "authenticated") {
      await enqueueAssistantMessage("Google account already connected.");
      await enqueueAssistantMessage(
        "Last step: what should we call your workspace?"
      );
      setStep("workspace");
      return;
    }

    await enqueueAssistantMessage("Great choice. Opening Google sign-in now.");
    setStep("google-wait");
    if (pendingHire) {
      const checkpoint: SavedOnboardingState = {
        roleSlug: pendingHire.roleSlug,
        resumeId: pendingHire.resume.id,
        messages,
        step: "google-wait",
        name,
        email,
        workspaceName,
        googleAuthChoice: true,
      };
      sessionStorage.setItem(
        ONBOARDING_STATE_KEY,
        JSON.stringify(checkpoint)
      );
    }
    await signIn("google", { callbackUrl: "/onboarding?oauth=google" });
  };

  const continueWithoutGoogle = async () => {
    setGoogleAuthChoice(false);
    await enqueueAssistantMessage(
      "No problem. We will continue with email and password."
    );
    await enqueueAssistantMessage(
      "Last step: what should we call your workspace?"
    );
    setStep("workspace");
  };

  const retryGoogle = async () => {
    setFormError(null);
    await signIn("google", { callbackUrl: "/onboarding?oauth=google" });
  };

  const handleLaunch = async () => {
    if (!pendingHire) {
      setFormError("Missing hire information. Please choose a candidate again.");
      return;
    }

    setFormError(null);
    setIsLaunching(true);

    try {
      const response = await fetch("/api/agents/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: pendingHire.roleSlug,
          backgroundId: pendingHire.resume.id,
          generatedName: pendingHire.resume.name,
          generatedResume: pendingHire.resume,
        }),
      });

      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details?.details ?? "Failed to complete hiring.");
      }

      localStorage.setItem(
        "ai_employee_profile",
        JSON.stringify({
          name,
          email,
          workspaceName,
          googleAuthChoice,
        })
      );

      const completionPayload = {
        ownerName: name || "there",
        workspaceName: workspaceName || "your workspace",
        hireName: pendingHire.resume.name,
        roleName: toRoleName(pendingHire.roleSlug),
        usedGoogle: googleAuthChoice === true,
        fromOAuthCallback: oauthFlag === "google",
      };
      sessionStorage.setItem(
        ONBOARDING_COMPLETE_KEY,
        JSON.stringify(completionPayload)
      );

      sessionStorage.removeItem(PENDING_HIRE_KEY);
      sessionStorage.removeItem(ONBOARDING_STATE_KEY);
      router.push("/welcome");
    } catch (launchError) {
      console.error("Failed to complete onboarding:", launchError);
      setFormError(
        launchError instanceof Error
          ? launchError.message
          : "Could not complete onboarding."
      );
      setIsLaunching(false);
    }
  };

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <p className="text-lg font-semibold">{loadError}</p>
          <button
            onClick={() => router.push("/hire")}
            className="w-full rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-3 font-semibold"
          >
            Pick a candidate
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="absolute -left-20 top-10 h-80 w-80 rounded-full bg-primary/20 blur-3xl"
          animate={{ x: [0, 30, -10, 0], y: [0, 25, -15, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
          animate={{ x: [0, -20, 15, 0], y: [0, -25, 20, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="relative mx-auto grid min-h-[92vh] max-w-6xl gap-6 lg:grid-cols-[1.1fr_1fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl border border-border bg-card/70 p-6 backdrop-blur sm:p-8"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-primary">
            Onboarding session
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
            {pendingHire?.resume.name ?? "Your new hire"} is ready to join.
          </h1>
          <p className="mt-3 text-sm text-muted">
            We are setting up your account and workspace for your first{" "}
            {roleName}.
          </p>

          <div className="mt-8 space-y-3 text-sm">
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <p className="text-xs uppercase tracking-wider text-muted">
                Candidate
              </p>
              <p className="mt-1 font-semibold">{pendingHire?.resume.name}</p>
              <p className="text-muted">{pendingHire?.resume.backgroundName}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Role</p>
              <p className="mt-1 font-semibold">{roleName}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <p className="text-xs uppercase tracking-wider text-muted">
                Status
              </p>
              <p className="mt-1 font-semibold text-primary">
                {isLaunching
                  ? "Launching your teammate..."
                  : step === "google-wait"
                  ? "Waiting for Google sign-in callback"
                  : "Collecting account setup details"}
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="flex min-h-[540px] flex-col rounded-3xl border border-border bg-card p-4 sm:p-6"
        >
          <div className="mb-4 border-b border-border pb-4">
            <p className="text-sm text-muted">Live setup chat</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.map(message => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${
                  message.role === "assistant" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "assistant"
                      ? "border border-border bg-background text-foreground"
                      : "bg-gradient-to-r from-primary to-secondary text-white"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <TypewriterText
                      text={message.text}
                      speedMs={message.typingSpeedMs ?? 16}
                    />
                  ) : (
                    message.text
                  )}
                </div>
              </motion.div>
            ))}

            {assistantTyping ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="max-w-[88%] rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted">
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.1s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/70" />
                  </span>
                </div>
              </motion.div>
            ) : null}
            <div ref={messageEndRef} />
          </div>

          <div className="mt-4 border-t border-border pt-4">
            {step === "google-choice" ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  onClick={() => void handleGoogleChoice(true)}
                  className="rounded-xl border border-primary/50 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20"
                >
                  Yes, use Google
                </button>
                <button
                  onClick={() => void handleGoogleChoice(false)}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold transition hover:border-primary/40"
                >
                  No, continue manually
                </button>
              </div>
            ) : step === "google-wait" ? (
              <div className="space-y-2">
                <button
                  onClick={() => void retryGoogle()}
                  className="w-full rounded-xl border border-primary/50 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20"
                >
                  Open Google sign-in again
                </button>
                <button
                  onClick={() => void continueWithoutGoogle()}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold transition hover:border-primary/40"
                >
                  Continue without Google
                </button>
              </div>
            ) : step === "launch-ready" ? (
              <button
                onClick={handleLaunch}
                disabled={isLaunching}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-secondary px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLaunching
                  ? "Launching teammate..."
                  : "Finish setup and launch teammate"}
              </button>
            ) : (
              <form onSubmit={event => void handleFormSubmit(event)} className="space-y-3">
                <input
                  value={inputValue}
                  onChange={event => setInputValue(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
                  placeholder={
                    step === "name"
                      ? "Enter your name"
                      : step === "email"
                      ? "Enter your email"
                      : "Workspace name"
                  }
                  type={step === "email" ? "email" : "text"}
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-primary to-secondary px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01]"
                >
                  Continue
                </button>
              </form>
            )}

            {formError ? (
              <p className="mt-3 text-xs text-red-300">{formError}</p>
            ) : null}
          </div>
        </motion.section>
      </div>
    </main>
  );
}
