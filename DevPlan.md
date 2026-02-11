Base Agent Framework — Implementation Plan
Context
Building a reusable TypeScript framework (@agents/base) that serves as the chassis for persistent AI "employee" agents. Each employee will be a separate project that imports this base and extends it with role-specific behavior, tools, and personality. The framework must be LLM-provider-agnostic (Anthropic + OpenAI), include memory with semantic search (pgvector), Slack integration, orchestration, and human-in-the-loop approvals.

Tech Stack
TypeScript / Node.js 22+
Prisma ORM + Neon Postgres + pgvector
Slack Bolt SDK
Anthropic SDK + OpenAI SDK
Zod (config validation), Pino (logging), node-cron (scheduling)
Vitest (testing)
Directory Structure

agents-base/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── .gitignore
├── .env.example
├── prisma/
│   └── schema.prisma           # Full schema with pgvector
├── src/
│   ├── index.ts                # Public API barrel export
│   ├── core/
│   │   ├── config/             # Zod config schema + env loader
│   │   ├── database/           # Prisma singleton + pgvector setup
│   │   ├── logger/             # Pino logger
│   │   ├── errors/             # Error class hierarchy
│   │   └── events/             # In-process EventBus
│   ├── llm/
│   │   ├── types.ts            # ILLMProvider, UnifiedToolDefinition, LLMRequest/Response
│   │   ├── client.ts           # LLMClient (universal interface)
│   │   ├── provider-registry.ts
│   │   ├── tool-schema-mapper.ts  # Unified → Anthropic/OpenAI format conversion
│   │   └── providers/
│   │       ├── base-provider.ts   # Abstract base
│   │       ├── anthropic.ts       # Claude provider
│   │       └── openai.ts          # GPT provider
│   ├── memory/
│   │   ├── types.ts
│   │   ├── memory-manager.ts   # Orchestrates short/long/shared memory
│   │   ├── short-term.ts       # Conversation buffer (DB-backed)
│   │   ├── long-term.ts        # pgvector semantic search ($queryRaw)
│   │   ├── shared.ts           # Cross-agent knowledge base
│   │   └── embeddings.ts       # Embedding generation via LLM provider
│   ├── tools/
│   │   ├── types.ts            # ITool, ToolDefinition, ToolResult
│   │   ├── registry.ts         # ToolRegistry
│   │   ├── executor.ts         # ToolExecutor (timeout, error handling)
│   │   └── base-tools/         # web-search, http-request, file-read/write,
│   │                           # memory-search, agent-message, human-approval
│   ├── agent/
│   │   ├── types.ts            # AgentState, AgentContext, AgentRunResult
│   │   ├── base-agent.ts       # Core agent loop (THE heart of the framework)
│   │   ├── agent-runner.ts     # Lifecycle management
│   │   └── context-builder.ts  # Assembles memory + tools into LLM context
│   ├── slack/
│   │   ├── types.ts
│   │   ├── slack-app.ts        # Bolt SDK wrapper
│   │   ├── message-router.ts   # Routes messages → correct agent
│   │   ├── message-sender.ts   # Send messages/threads/DMs
│   │   ├── event-handlers.ts   # @mentions, DMs, channel messages
│   │   ├── command-handlers.ts # Slash commands
│   │   └── approval-ui.ts      # Block Kit UI for HITL approvals
│   ├── orchestration/
│   │   ├── scheduler.ts        # node-cron wrapper
│   │   ├── task-queue.ts       # DB-backed async task queue
│   │   ├── trigger-manager.ts  # Event-driven triggers
│   │   └── inter-agent.ts      # Agent-to-agent messaging
│   ├── approval/
│   │   ├── types.ts
│   │   ├── approval-manager.ts # Creates gates, sends Slack buttons, waits
│   │   └── approval-store.ts   # DB persistence
│   └── framework/
│       ├── bootstrap.ts        # Main boot sequence (wires everything)
│       ├── shutdown.ts         # Graceful shutdown (SIGTERM/SIGINT)
│       ├── agent-registry.ts   # Tracks all running agent instances
│       └── health.ts           # Health check endpoint
└── tests/
    ├── unit/
    └── integration/
Prisma Schema (key models)
Agent — name, system_prompt, llm_provider, llm_model, tools[], slack_bot_token, slack_channels[], memory_namespace
Conversation + ConversationMessage — short-term memory, linked to agent
MemoryEntry — long-term memory with vector(1536) embedding column, namespace, importance, tags, TTL
ScheduledTask — cron expressions per agent
TaskQueueItem — DB-backed async queue with status, priority, retry
ApprovalRequest — HITL gates with status, Slack message reference, expiry
AgentMessage — inter-agent communication with correlation IDs
pgvector similarity search uses $queryRaw (Prisma doesn't natively support vector ops). HNSW index created via raw SQL migration.

Core Agent Loop (base-agent.ts)
Receive input + context
Retrieve conversation history (short-term memory)
Retrieve relevant memories via semantic search (long-term memory)
Build messages array with system prompt + context
Call LLM with tools available
If LLM returns tool calls → execute them (with approval gates if needed)
Feed tool results back → repeat from step 5
When LLM returns final response (no tool calls) → store in memory → return
Max iteration guard (default 10) prevents runaway loops
Extension points for employee agents: beforeLLMCall(), onRunComplete(), onToolError(), shouldRequireApproval(), buildSystemPrompt()

LLM Provider Abstraction
ILLMProvider interface with complete() and generateEmbedding() methods
UnifiedToolDefinition format that maps to both Anthropic and OpenAI schemas
tool-schema-mapper.ts handles bidirectional conversion
Provider chosen per-agent via config (e.g., Claude for dev agents, GPT for architecture agents)
How Employee Projects Use This

import { AgentFramework, BaseAgent } from '@agents/base';

const framework = new AgentFramework();
await framework.boot([{
  config: { name: 'seo-agent', llmProvider: 'anthropic', ... },
  createAgent: (deps) => new SeoAgent(deps),  // extends BaseAgent
  customTools: [new KeywordResearchTool()],    // implements ITool
}]);
Build Order (8 phases, ~46 files)
Phase 1 — Foundation
package.json, tsconfig.json, .gitignore, .env.example
src/core/config/ — Zod schema + env loader
src/core/logger/ — Pino setup
src/core/errors/ — AppError, ValidationError, etc.
src/core/events/ — EventBus (EventEmitter wrapper)
src/core/database/ — Prisma client singleton
prisma/schema.prisma — Full schema with pgvector
Phase 2 — LLM Layer
src/llm/types.ts — All LLM interfaces
src/llm/tool-schema-mapper.ts
src/llm/providers/ — base, anthropic, openai
src/llm/provider-registry.ts + src/llm/client.ts
Phase 3 — Memory
src/memory/types.ts + src/memory/embeddings.ts
src/memory/short-term.ts, long-term.ts, shared.ts
src/memory/memory-manager.ts
Phase 4 — Approval + Tools
src/approval/ — types, store, manager
src/tools/ — types, registry, executor
src/tools/base-tools/ — all 7 base tools
Phase 5 — Agent Core
src/agent/ — types, context-builder, base-agent, agent-runner
Phase 6 — Slack
src/slack/ — all 7 files
Phase 7 — Orchestration
src/orchestration/ — scheduler, task-queue, trigger-manager, inter-agent
Phase 8 — Framework Bootstrap
src/framework/ — agent-registry, health, shutdown, bootstrap
src/index.ts — barrel export
Verification
npm run type-check passes with no errors
npm run build produces clean dist/ output
prisma generate succeeds against Neon connection
prisma migrate dev creates all tables + pgvector extension
Unit tests pass for LLM tool-schema-mapper, tool registry, memory manager
Integration test: instantiate a BaseAgent with mock LLM, run a conversation loop, verify memory storage