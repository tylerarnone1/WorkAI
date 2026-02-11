"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Home() {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  const stagger = {
    visible: {
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center p-8">
      <div className="absolute right-6 top-6">
        <Link
          href="/login"
          className="inline-flex items-center rounded-lg border border-border bg-card/70 px-4 py-2 text-sm font-medium text-foreground/90 transition-colors hover:border-primary/60 hover:text-foreground"
        >
          Returning user login
        </Link>
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="max-w-4xl w-full text-center space-y-12"
      >
        <motion.div variants={fadeIn} className="flex justify-center">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center text-4xl card-glow">
            AI
          </div>
        </motion.div>

        <motion.div variants={fadeIn} className="space-y-4">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
            Hire AI Employees
            <br />
            <span className="text-gradient">That Actually Work Together</span>
          </h1>
          <p className="text-xl text-muted max-w-2xl mx-auto">
            Build your virtual workforce. Each employee has a unique background,
            personality, and working style. No code required.
          </p>
        </motion.div>

        <motion.div variants={fadeIn} className="space-y-4">
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/hire">
              <button className="group relative px-8 py-4 bg-gradient-to-r from-primary to-secondary rounded-xl text-lg font-semibold overflow-hidden transition-all duration-300 hover:scale-105 card-glow-hover">
                <span className="relative z-10">Hire Your First Employee</span>
                <div className="absolute inset-0 bg-gradient-to-r from-secondary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </button>
            </Link>
            <Link href="/login">
              <button className="px-8 py-4 rounded-xl text-lg font-semibold border border-border bg-card hover:border-primary/50 transition-colors">
                Returning User
              </button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">
            First hire is free | No credit card required
          </p>
        </motion.div>

        <motion.div
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12"
        >
          {[
            {
              icon: "01",
              title: "Unique Personalities",
              desc: "Each AI has distinct working styles and backgrounds",
            },
            {
              icon: "02",
              title: "Real Collaboration",
              desc: "They work together in Slack, just like humans",
            },
            {
              icon: "03",
              title: "Deploy Instantly",
              desc: "Hire in 60 seconds, no technical setup needed",
            },
          ].map((feature, i) => (
            <motion.div
              key={i}
              variants={fadeIn}
              className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors duration-300"
            >
              <div className="text-2xl mb-3 font-mono text-primary">{feature.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={fadeIn} className="pt-8">
          <p className="text-sm text-muted">
            Join <span className="text-foreground font-semibold">100+ companies</span>{" "}
            building with AI teams
          </p>
        </motion.div>
      </motion.div>
    </main>
  );
}