"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

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

interface ResumeCardProps {
  resume: Resume;
  onHire: (id: string) => void;
  isHiring: boolean;
}

export default function ResumeCard({
  resume,
  onHire,
  isHiring,
}: ResumeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="h-full flex flex-col p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300">
      {/* Header */}
      <div className="space-y-4 mb-6">
        <div>
          <h3 className="text-2xl font-bold mb-1">{resume.name}</h3>
          <p className="text-sm text-primary font-medium">
            {resume.backgroundName}
          </p>
          <p className="text-xs text-muted mt-1">
            {resume.backgroundDescription}
          </p>
        </div>

        {/* Personality Tags */}
        <div className="flex flex-wrap gap-2">
          {resume.personality.map((trait) => (
            <span
              key={trait}
              className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20"
            >
              {trait}
            </span>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="flex-1 space-y-4 mb-6">
        <p className="text-sm text-muted leading-relaxed">{resume.summary}</p>

        {/* Skills */}
        <div>
          <h4 className="text-xs font-semibold text-foreground/70 mb-2 uppercase tracking-wide">
            Key Skills
          </h4>
          <div className="flex flex-wrap gap-2">
            {resume.skills.map((skill) => (
              <span
                key={skill}
                className="px-2 py-1 text-xs rounded bg-card-hover text-muted"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Expandable Details */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          <span>{isExpanded ? "Less" : "More"} details</span>
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            ↓
          </motion.span>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-4 border-t border-border">
                {/* Experience */}
                <div>
                  <h4 className="text-xs font-semibold text-foreground/70 mb-3 uppercase tracking-wide">
                    Experience
                  </h4>
                  <div className="space-y-3">
                    {resume.experience.map((exp, i) => (
                      <div key={i} className="space-y-1">
                        <div>
                          <p className="text-sm font-medium">{exp.title}</p>
                          <p className="text-xs text-muted">
                            {exp.company} • {exp.duration}
                          </p>
                        </div>
                        <ul className="space-y-1 ml-3">
                          {exp.highlights.map((highlight, j) => (
                            <li
                              key={j}
                              className="text-xs text-muted list-disc list-inside"
                            >
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Working Style */}
                <div>
                  <h4 className="text-xs font-semibold text-foreground/70 mb-2 uppercase tracking-wide">
                    Working Style
                  </h4>
                  <p className="text-xs text-muted leading-relaxed">
                    {resume.workingStyle}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hire Button */}
      <button
        onClick={() => onHire(resume.id)}
        disabled={isHiring}
        className="w-full py-3 px-4 bg-gradient-to-r from-primary to-secondary rounded-xl font-semibold text-sm hover:scale-105 transition-transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {isHiring ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Hiring...
          </span>
        ) : (
          "Hire This Candidate"
        )}
      </button>
    </div>
  );
}
