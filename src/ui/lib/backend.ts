// Backend service integrations for Next.js API routes
// This file creates singleton instances of backend services

import { LLMClient } from "../../llm/client";
import { ResumeGenerator } from "../../templates/resume-generator";
import { DynamicAgentLoader } from "../../hiring/dynamic-agent-loader";
import { ContainerProvisioner } from "../../container/container-provisioner";
import { getPrisma as getBackendPrisma } from "../../core/database/index";

// Singleton instances
let llmClient: LLMClient | null = null;
let resumeGenerator: ResumeGenerator | null = null;
let agentLoader: DynamicAgentLoader | null = null;

type LlmRuntimeConfig = {
  provider: "anthropic" | "openai";
  apiKey: string;
  model: string;
  baseUrl?: string;
};

function resolveResumeLlmRuntimeConfig(base: LlmRuntimeConfig): LlmRuntimeConfig {
  if (base.provider !== "openai") {
    return base;
  }

  const explicitResumeModel = process.env.OPENAI_RESUME_MODEL?.trim();
  const model =
    explicitResumeModel && explicitResumeModel.length > 0
      ? explicitResumeModel
      : base.model.startsWith("gpt-5")
      ? "gpt-4o-mini"
      : base.model;

  return { ...base, model };
}

function resolveLlmRuntimeConfig(): LlmRuntimeConfig {
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiApiKey) {
    return {
      provider: "openai",
      apiKey: openaiApiKey,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      baseUrl: process.env.OPENAI_BASE_URL,
    };
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicApiKey) {
    return {
      provider: "anthropic",
      apiKey: anthropicApiKey,
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
      baseUrl: process.env.ANTHROPIC_BASE_URL,
    };
  }

  throw new Error(
    "No LLM API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
  );
}

/**
 * Get or create LLM client.
 */
export function getLLMClient(): LLMClient {
  if (!llmClient) {
    const cfg = resolveLlmRuntimeConfig();
    llmClient = new LLMClient(cfg.provider, {
      apiKey: cfg.apiKey,
      model: cfg.model,
      baseUrl: cfg.baseUrl,
    });
  }
  return llmClient;
}

/**
 * Get or create Resume Generator
 */
export function getResumeGenerator(): ResumeGenerator {
  if (!resumeGenerator) {
    const baseCfg = resolveLlmRuntimeConfig();
    const resumeCfg = resolveResumeLlmRuntimeConfig(baseCfg);
    const resumeLlmClient = new LLMClient(resumeCfg.provider, {
      apiKey: resumeCfg.apiKey,
      model: resumeCfg.model,
      baseUrl: resumeCfg.baseUrl,
    });
    resumeGenerator = new ResumeGenerator(resumeLlmClient);
  }
  return resumeGenerator;
}

/**
 * Get or create Dynamic Agent Loader
 */
export function getAgentLoader(): DynamicAgentLoader {
  if (!agentLoader) {
    const containerProvisioner = new ContainerProvisioner();
    agentLoader = new DynamicAgentLoader(containerProvisioner);
  }
  return agentLoader;
}

/**
 * Get Prisma client
 */
export function getPrisma() {
  return getBackendPrisma();
}
