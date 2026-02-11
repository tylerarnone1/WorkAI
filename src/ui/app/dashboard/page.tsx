"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";

interface AgentActivity {
  id: string;
  agentId: string;
  name: string;
  role?: string;
  status: "active" | "idle" | "stopped";
  currentTask: string | null;
  tokenUsage: {
    today: number;
    total: number;
  };
  backgroundName?: string;
  hiredAt?: string;
  containerInfo?: {
    portRange?: { start: number; end: number };
    status: string;
  } | null;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [agents, setAgents] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAgents() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/agents", { cache: "no-store" });
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(details?.details ?? "Failed to load agents.");
        }

        const data = (await response.json()) as { agents?: AgentActivity[] };
        if (!cancelled) {
          setAgents(Array.isArray(data.agents) ? data.agents : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load dashboard data."
          );
          setAgents([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAgents();

    return () => {
      cancelled = true;
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "idle":
        return "bg-yellow-500";
      case "stopped":
        return "bg-red-500";
      default:
        return "bg-gray-500";
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
        staggerChildren: 0.1,
      },
    },
  };

  const totalTokens = agents.reduce((sum, a) => sum + a.tokenUsage.total, 0);
  const todayTokens = agents.reduce((sum, a) => sum + a.tokenUsage.today, 0);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="space-y-8"
        >
          {/* Header */}
          <motion.div
            variants={fadeIn}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
                <span className="text-gradient">Dashboard</span>
              </h1>
              <p className="text-muted">
                Monitor your AI employees and track usage
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-muted md:inline">
                {session?.user?.email ?? "Local session"}
              </span>
              <button
                onClick={() => void signOut({ callbackUrl: "/login" })}
                className="px-4 py-3 rounded-xl border border-border bg-card text-sm font-semibold hover:border-primary/50 transition-colors"
              >
                Sign out
              </button>
              <Link href="/hire">
                <button className="px-6 py-3 bg-gradient-to-r from-primary to-secondary rounded-xl font-semibold text-sm hover:scale-105 transition-transform">
                  + Hire Another
                </button>
              </Link>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <motion.div
              variants={fadeIn}
              className="p-6 rounded-xl bg-card border border-border"
            >
              <p className="text-sm text-muted mb-1">Active Employees</p>
              <p className="text-3xl font-bold">
                {agents.filter((a) => a.status === "active").length}
              </p>
            </motion.div>

            <motion.div
              variants={fadeIn}
              className="p-6 rounded-xl bg-card border border-border"
            >
              <p className="text-sm text-muted mb-1">Tokens Today</p>
              <p className="text-3xl font-bold">
                {todayTokens.toLocaleString()}
              </p>
            </motion.div>

            <motion.div
              variants={fadeIn}
              className="p-6 rounded-xl bg-card border border-border"
            >
              <p className="text-sm text-muted mb-1">Total Tokens</p>
              <p className="text-3xl font-bold">
                {totalTokens.toLocaleString()}
              </p>
            </motion.div>
          </motion.div>

          {/* Agents List */}
          <motion.div variants={fadeIn} className="space-y-4">
            <h2 className="text-2xl font-bold">Your Team</h2>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}

            {!loading && error && (
              <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/10">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {!loading && !error && agents.length === 0 && (
              <div className="p-12 rounded-xl bg-card border border-border text-center">
                <p className="text-muted mb-4">No employees hired yet</p>
                <Link href="/hire">
                  <button className="px-6 py-3 bg-gradient-to-r from-primary to-secondary rounded-xl font-semibold text-sm hover:scale-105 transition-transform">
                    Hire Your First Employee
                  </button>
                </Link>
              </div>
            )}

            {!loading && !error && agents.length > 0 && (
              <div className="space-y-4">
                {agents.map((agent) => (
                  <motion.div
                    key={agent.id}
                    variants={fadeIn}
                    className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-3 h-3 rounded-full ${getStatusColor(
                            agent.status
                          )} mt-1.5`}
                        />
                        <div>
                          <h3 className="text-xl font-bold">{agent.name}</h3>
                          <p className="text-sm text-muted">
                            {agent.role ?? "AI Employee"}
                            {agent.backgroundName ? ` | ${agent.backgroundName}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted mb-1">Status</p>
                        <p className="text-sm font-medium capitalize">
                          {agent.status}
                        </p>
                      </div>
                    </div>

                    {agent.currentTask && (
                      <div className="mb-4 p-3 rounded-lg bg-background/50">
                        <p className="text-xs text-muted mb-1">Current Task</p>
                        <p className="text-sm">{agent.currentTask}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted mb-1">
                          Tokens (Today)
                        </p>
                        <p className="font-medium">
                          {agent.tokenUsage.today.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted mb-1">
                          Tokens (Total)
                        </p>
                        <p className="font-medium">
                          {agent.tokenUsage.total.toLocaleString()}
                        </p>
                      </div>
                      {agent.containerInfo && (
                        <>
                          <div>
                            <p className="text-xs text-muted mb-1">
                              Port Range
                            </p>
                            <p className="font-medium font-mono text-xs">
                              {agent.containerInfo.portRange?.start} -{" "}
                              {agent.containerInfo.portRange?.end}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted mb-1">
                              Container
                            </p>
                            <p className="font-medium capitalize text-xs">
                              {agent.containerInfo.status}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {agent.hiredAt ? (
                      <p className="mt-4 text-xs text-muted">
                        Hired {new Date(agent.hiredAt).toLocaleString()}
                      </p>
                    ) : null}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
