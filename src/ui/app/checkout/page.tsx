"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function CheckoutPage() {
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

  const plans = [
    {
      name: "Starter",
      price: "$99",
      period: "/month",
      description: "Perfect for small teams getting started",
      features: [
        "Up to 3 AI employees",
        "Unlimited conversations",
        "1M tokens/month included",
        "Slack integration",
        "Email support",
      ],
      cta: "Start 14-Day Trial",
      highlighted: false,
    },
    {
      name: "Professional",
      price: "$299",
      period: "/month",
      description: "For growing teams that need more power",
      features: [
        "Up to 10 AI employees",
        "Unlimited conversations",
        "5M tokens/month included",
        "Slack + API access",
        "Priority support",
        "Custom backgrounds",
      ],
      cta: "Start 14-Day Trial",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations with specific needs",
      features: [
        "Unlimited AI employees",
        "Unlimited conversations",
        "Custom token limits",
        "Dedicated infrastructure",
        "24/7 phone support",
        "Custom integrations",
        "SLA guarantees",
      ],
      cta: "Contact Sales",
      highlighted: false,
    },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="space-y-12"
        >
          {/* Header */}
          <motion.div variants={fadeIn} className="text-center space-y-4">
            <div className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              Your first hire was free!
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Ready to{" "}
              <span className="text-gradient">Scale Your AI Team?</span>
            </h1>
            <p className="text-xl text-muted max-w-2xl mx-auto">
              Choose a plan to hire more AI employees and unlock the full
              potential of your virtual workforce
            </p>
          </motion.div>

          {/* Pricing Cards */}
          <motion.div
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {plans.map((plan) => (
              <motion.div
                key={plan.name}
                variants={fadeIn}
                className={`relative p-8 rounded-2xl border transition-all duration-300 hover:scale-105 ${
                  plan.highlighted
                    ? "bg-gradient-to-b from-card to-card/50 border-primary shadow-xl shadow-primary/20"
                    : "bg-card border-border"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-primary to-secondary text-sm font-semibold">
                    Most Popular
                  </div>
                )}

                <div className="space-y-6">
                  {/* Plan Header */}
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <p className="text-sm text-muted">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    <span className="text-muted">{plan.period}</span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3 text-sm"
                      >
                        <span className="text-primary mt-0.5">✓</span>
                        <span className="text-muted">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                      plan.highlighted
                        ? "bg-gradient-to-r from-primary to-secondary hover:scale-105"
                        : "bg-card-hover border border-border hover:border-primary/50"
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* FAQ Section */}
          <motion.div
            variants={fadeIn}
            className="pt-12 border-t border-border"
          >
            <h2 className="text-2xl font-bold text-center mb-8">
              Frequently Asked Questions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="space-y-2">
                <h4 className="font-semibold">What happens after the trial?</h4>
                <p className="text-sm text-muted">
                  You'll be automatically billed at the end of your 14-day
                  trial. Cancel anytime before then to avoid charges.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Can I change plans later?</h4>
                <p className="text-sm text-muted">
                  Yes! Upgrade or downgrade your plan at any time. Changes take
                  effect immediately.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">
                  What if I exceed my token limit?
                </h4>
                <p className="text-sm text-muted">
                  Additional tokens are available at $10 per 100K tokens. You'll
                  be notified before reaching your limit.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Is my data secure?</h4>
                <p className="text-sm text-muted">
                  All data is encrypted at rest and in transit. We're SOC 2
                  Type II certified and never train models on your data.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Back Link */}
          <motion.div variants={fadeIn} className="text-center pt-8">
            <Link
              href="/dashboard"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              ← Back to dashboard
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
