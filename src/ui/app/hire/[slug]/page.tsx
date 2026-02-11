"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSession } from "next-auth/react";
import ResumeCard from "@/components/ResumeCard";

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

type HirePhase = "idle" | "drop" | "center" | "launch";

const PENDING_HIRE_KEY = "ai_employee_pending_hire";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function CandidatesPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [phase, setPhase] = useState<HirePhase>("idle");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleNames: Record<string, string> = {
    "seo-engineer": "SEO Engineer",
    "backend-engineer": "Backend Engineer",
    "frontend-engineer": "Frontend Engineer",
    "project-manager": "Project Manager",
    "operations-manager": "Operations Manager",
  };

  const selectedResume = useMemo(
    () => resumes.find(resume => resume.id === selectedCandidate) ?? null,
    [resumes, selectedCandidate],
  );

  useEffect(() => {
    async function loadResumes() {
      try {
        const response = await fetch(`/api/resumes/generate?role=${slug}`);
        const data = (await response.json()) as { resumes: Resume[] };
        setResumes(Array.isArray(data.resumes) ? data.resumes : []);
      } catch (loadError) {
        console.error("Failed to load resumes:", loadError);
        setError("Unable to load candidates right now. Please refresh.");
      } finally {
        setLoading(false);
      }
    }

    loadResumes();
  }, [slug]);

  const handleHire = async (resumeId: string) => {
    if (isTransitioning) {
      return;
    }

    setSelectedCandidate(resumeId);
    setError(null);

    try {
      // Only enforce paywall for authenticated sessions.
      // Unauthenticated users can still run through onboarding while testing.
      const session = await getSession();
      if (session) {
        const agentsResponse = await fetch("/api/agents", { cache: "no-store" });
        const { agents } = (await agentsResponse.json()) as { agents: unknown[] };

        if (Array.isArray(agents) && agents.length >= 1) {
          window.location.href = "/checkout";
          return;
        }
      }

      const resume = resumes.find(item => item.id === resumeId);
      if (!resume) {
        throw new Error("Selected candidate could not be found.");
      }

      setIsTransitioning(true);
      setPhase("drop");
      await sleep(520);

      setPhase("center");
      await sleep(850);

      setPhase("launch");

      const payload = {
        roleSlug: slug,
        resume,
        capturedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(PENDING_HIRE_KEY, JSON.stringify(payload));

      await sleep(980);
      router.push("/onboarding");
    } catch (hireError) {
      console.error("Error starting hire flow:", hireError);
      setError(hireError instanceof Error ? hireError.message : "Failed to start onboarding.");
      setIsTransitioning(false);
      setPhase("idle");
      setSelectedCandidate(null);
    }
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  const stagger = {
    visible: {
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  return (
    <main className="min-h-screen overflow-hidden p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-8">
          <motion.div variants={fadeIn} className="space-y-4">
            <Link
              href="/hire"
              className="inline-block text-sm text-muted hover:text-foreground transition-colors"
            >
              {"<-"} Back to roles
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              {roleNames[slug] || "Role"} <span className="text-gradient">Candidates</span>
            </h1>
            <p className="text-lg text-muted max-w-2xl">
              Pick one teammate to launch first. We will animate the handoff and bring you into setup.
            </p>
          </motion.div>

          {loading && (
            <motion.div variants={fadeIn} className="flex items-center justify-center py-20">
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-muted">Generating AI candidates...</p>
              </div>
            </motion.div>
          )}

          {!loading && (
            <motion.div variants={stagger} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {resumes.map((resume, index) => {
                const isSelected = selectedCandidate === resume.id;
                const isUnselected = selectedCandidate !== null && !isSelected;
                const hideOriginalSelected = isSelected && isTransitioning && phase !== "idle";

                const desktopCenterOffset = index === 0 ? 220 : index === 2 ? -220 : 0;

                const animateTarget = isUnselected && isTransitioning
                  ? {
                      opacity: 0,
                      y: 780,
                      rotate: index === 0 ? -8 : 8,
                      scale: 0.92,
                    }
                  : hideOriginalSelected
                    ? {
                        opacity: 0,
                        scale: 0.95,
                      }
                    : {
                        opacity: 1,
                        y: 0,
                        rotate: 0,
                        scale: 1,
                        x: 0,
                      };

                return (
                  <motion.div
                    key={resume.id}
                    variants={fadeIn}
                    animate={animateTarget}
                    transition={{
                      duration: isUnselected && isTransitioning ? 0.6 : 0.35,
                      ease: isUnselected && isTransitioning ? "easeIn" : "easeOut",
                    }}
                    style={{ zIndex: isSelected ? 20 : 1 }}
                  >
                    <motion.div
                      animate={
                        isSelected && phase === "center"
                          ? { x: desktopCenterOffset, scale: 1.04 }
                          : { x: 0, scale: 1 }
                      }
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    >
                      <ResumeCard
                        resume={resume}
                        onHire={handleHire}
                        isHiring={selectedCandidate === resume.id}
                      />
                    </motion.div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {!loading && (
            <motion.div variants={fadeIn} className="p-6 rounded-xl bg-card border border-border text-center">
              <p className="text-sm text-muted">
                Candidates are generated with OpenAI and tuned for role-specific backgrounds and work styles.
              </p>
            </motion.div>
          )}

          {error ? (
            <motion.p variants={fadeIn} className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </motion.p>
          ) : null}
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedResume && isTransitioning && phase !== "drop" ? (
          <motion.div
            key={selectedResume.id}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={
              phase === "center"
                ? { opacity: 1, y: 0, scale: 1.08, rotate: 0 }
                : { opacity: 1, y: -980, scale: 0.64, rotate: -8 }
            }
            exit={{ opacity: 0 }}
            transition={{
              duration: phase === "center" ? 0.7 : 1.05,
              ease: phase === "center" ? "easeOut" : "easeIn",
            }}
          >
            <div className="relative w-full max-w-2xl">
              {phase === "launch" ? (
                <motion.div
                  className="absolute left-1/2 top-[calc(100%+12px)] h-24 w-20 -translate-x-1/2 rounded-full bg-gradient-to-b from-accent/80 via-orange-400/70 to-yellow-300/10 blur-md"
                  animate={{ scaleY: [1, 1.3, 0.9, 1.2], opacity: [0.9, 1, 0.8, 0.95] }}
                  transition={{ duration: 0.2, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : null}

              <div className="rounded-3xl border border-primary/50 shadow-2xl shadow-primary/30">
                <ResumeCard resume={selectedResume} onHire={() => undefined} isHiring />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
