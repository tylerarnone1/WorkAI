"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const roles = [
  {
    slug: "seo-engineer",
    title: "SEO Engineer",
    icon: "🔍",
    description: "Drive organic growth with technical SEO expertise",
    color: "from-blue-500 to-cyan-500",
  },
  {
    slug: "backend-engineer",
    title: "Backend Engineer",
    icon: "⚙️",
    description: "Build scalable APIs and database architecture",
    color: "from-purple-500 to-pink-500",
  },
  {
    slug: "frontend-engineer",
    title: "Frontend Engineer",
    icon: "🎨",
    description: "Craft beautiful, responsive user interfaces",
    color: "from-orange-500 to-red-500",
  },
  {
    slug: "project-manager",
    title: "Project Manager",
    icon: "📊",
    description: "Keep teams aligned and projects on track",
    color: "from-green-500 to-emerald-500",
  },
  {
    slug: "operations-manager",
    title: "Operations Manager",
    icon: "🔧",
    description: "Optimize processes and scale operations",
    color: "from-indigo-500 to-violet-500",
  },
];

export default function HirePage() {
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

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="space-y-12"
        >
          {/* Header */}
          <motion.div variants={fadeIn} className="text-center space-y-4">
            <Link
              href="/"
              className="inline-block text-sm text-muted hover:text-foreground transition-colors"
            >
              ← Back to home
            </Link>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Choose Your{" "}
              <span className="text-gradient">First Employee</span>
            </h1>
            <p className="text-xl text-muted max-w-2xl mx-auto">
              Select a role to see AI candidates with different backgrounds and
              working styles
            </p>
          </motion.div>

          {/* Role Grid */}
          <motion.div
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {roles.map((role) => (
              <motion.div key={role.slug} variants={fadeIn}>
                <Link href={`/hire/${role.slug}`}>
                  <div className="group relative p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden">
                    {/* Gradient overlay on hover */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${role.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                    />

                    <div className="relative space-y-4">
                      <div className="text-6xl">{role.icon}</div>
                      <div>
                        <h3 className="text-2xl font-bold mb-2">
                          {role.title}
                        </h3>
                        <p className="text-muted">{role.description}</p>
                      </div>
                      <div className="flex items-center text-sm text-primary font-medium">
                        <span>View candidates</span>
                        <span className="ml-2 group-hover:translate-x-1 transition-transform">
                          →
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* Info Banner */}
          <motion.div
            variants={fadeIn}
            className="p-6 rounded-xl bg-card border border-primary/20 text-center"
          >
            <p className="text-muted">
              <span className="text-foreground font-semibold">
                Your first hire is free
              </span>{" "}
              — No credit card required until you hire your second employee
            </p>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
