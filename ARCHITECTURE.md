# Architecture Overview

## System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                   Virtual Employees (Your Code)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ SEO Engineer │  │Backend Engr. │  │Project Mgr.  │ ...  │
│  │  (extends    │  │  (extends    │  │  (extends    │      │
│  │  BaseAgent)  │  │  BaseAgent)  │  │  BaseAgent)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               @agents/base Framework (This Repo)             │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  AgentFramework  │  │   BaseAgent      │                │
│  │  - Bootstrap     │  │   - Run loop     │                │
│  │  - Registry      │  │   - Memory       │                │
│  │  - Lifecycle     │  │   - Tools        │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │ Core Systems                                      │       │
│  │  • LLM (Anthropic + OpenAI)                      │       │
│  │  • Memory (Short-term + Long-term + Shared)      │       │
│  │  • Tools (Base + Collaboration + Integrations)   │       │
│  │  • Approval (HITL gates)                         │       │
│  │  • Slack (Multi-bot orchestration)               │       │
│  │  • Orchestration (Cron + Task Queue)             │       │
│  │  • Org (Hierarchy + Discovery)                   │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  External Services                           │
│                                                               │
│  Database      Slack        LLM APIs      Integrations       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Neon    │  │ Slack   │  │Anthropic│  │ GitHub  │        │
│  │ Postgres│  │ Socket  │  │ OpenAI  │  │ Google  │        │
│  │+pgvector│  │  Mode   │  │         │  │ ClickUp │  ...   │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Agent Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Framework Boot                                             │
│    AgentFramework.boot([employee1, employee2, ...])           │
└──────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Initialization Sequence                                    │
│    • Load config from env                                     │
│    • Connect to database (Neon + pgvector)                    │
│    • Initialize event bus                                     │
│    • Setup embedding provider                                 │
│    • Register base tools                                      │
│    • Setup approval system                                    │
│    • Register integrations → add integration tools            │
│    • Create agent instances from EmployeeDefinitions          │
│    • Persist agent configs to database                        │
│    • Start Slack socket connections (1 per agent)             │
│    • Start cron scheduler                                     │
│    • Start task queue worker                                  │
│    • Start inter-agent message bus                            │
│    • Start health check server                                │
│    • Register graceful shutdown handlers                      │
└──────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Running State (listening for triggers)                     │
│    • Slack messages (@mention or DM)                          │
│    • Scheduled tasks (cron)                                   │
│    • Task queue items (delegated work)                        │
│    • Inter-agent messages                                     │
│    • Webhooks (GitHub, ClickUp, etc.)                         │
└──────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Agent Run Triggered                                        │
│    agent.run(input, context)                                  │
└──────────────────────────────────────────────────────────────┘
```

## Agent Run Loop (Inside BaseAgent)

```
Input arrives (from Slack, cron, etc.)
          │
          ▼
┌─────────────────────────────────────────┐
│ 1. Retrieve Context                     │
│    • Get conversation history from DB   │
│    • Search relevant memories           │
│    • Build context with org awareness   │
└─────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ 2. Build System Prompt                  │
│    • Base prompt from config            │
│    • Inject role/team/expertise         │
│    • Inject collaboration tools         │
│    • Add current date                   │
└─────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ 3. Agentic Loop (max 10 iterations)    │
│    ┌─────────────────────────────────┐ │
│    │ a. Call LLM with:               │ │
│    │    - System prompt              │ │
│    │    - Conversation history       │ │
│    │    - Relevant memories          │ │
│    │    - Available tools            │ │
│    │    - New input                  │ │
│    └─────────────────────────────────┘ │
│              │                          │
│              ▼                          │
│    ┌─────────────────────────────────┐ │
│    │ b. LLM Response                 │ │
│    │    - Final answer? → Done       │ │
│    │    - Tool calls? → Execute      │ │
│    └─────────────────────────────────┘ │
│              │                          │
│              ▼                          │
│    ┌─────────────────────────────────┐ │
│    │ c. Execute Tools                │ │
│    │    - Check approval needed?     │ │
│    │    - Execute with timeout       │ │
│    │    - Return results to LLM      │ │
│    └─────────────────────────────────┘ │
│              │                          │
│              └──────┐                   │
│                     ▼                   │
│    ┌─────────────────────────────────┐ │
│    │ d. Approval Pending?            │ │
│    │    Yes → Pause, notify Slack    │ │
│    │    No  → Continue loop          │ │
│    └─────────────────────────────────┘ │
└─────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ 4. Completion                           │
│    • Store final response in memory     │
│    • Call onRunComplete() hook          │
│    • Emit completion event              │
│    • Return AgentRunResult              │
└─────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ 5. Response Delivery                    │
│    • Reply in Slack thread              │
│    • Update task queue item status      │
│    • Notify requesting agent            │
└─────────────────────────────────────────┘
```

## Memory System

```
┌────────────────────────────────────────────────────────────┐
│                    MemoryManager                            │
│  (Orchestrates all memory operations for an agent)          │
└────────────────────────────────────────────────────────────┘
           │                │                 │
           ▼                ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Short-Term   │  │ Long-Term    │  │ Shared       │
│ Memory       │  │ Memory       │  │ Memory       │
│              │  │              │  │              │
│ Conversation │  │ Embeddings   │  │ Cross-agent  │
│ history in   │  │ + pgvector   │  │ knowledge    │
│ Postgres     │  │ similarity   │  │ base         │
│              │  │ search       │  │              │
│ Scoped to    │  │ Scoped to    │  │ Namespace:   │
│ conversation │  │ agent        │  │ 'shared'     │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Query flow:**
1. Input arrives: "What was our Q3 revenue?"
2. MemoryManager.searchAll() queries:
   - Agent's long-term memory (past conversations about revenue)
   - Shared memory (company metrics visible to all agents)
3. Top 5 most relevant memories (by cosine similarity)
4. Injected into LLM context
5. LLM generates answer with context
6. Answer stored as new memory entry

## Tool System

```
┌──────────────────────────────────────────────────────────┐
│                    ToolRegistry                           │
│  (Central registry of all available tools)                │
└──────────────────────────────────────────────────────────┘
       │
       ├──▶ Base Tools (6)
       │    • web_search, http_request, memory_search,
       │      memory_store, agent_message, human_approval
       │
       ├──▶ Collaboration Tools (3)
       │    • find_expert, ask_colleague, delegate_task
       │
       └──▶ Integration Tools (40+)
            • GitHub (6), Google Calendar (3), Google Drive (4),
            • Gmail (4), ClickUp (6), Figma (4), Jira (6),
            • HubSpot (6), ArgoCD (5)

Agent config specifies tool names → ToolRegistry filters →
  Passed to LLM as function schemas
```

**Execution flow:**
```
LLM returns tool call
      │
      ▼
ToolExecutor.execute()
      │
      ├──▶ Check: requiresApproval?
      │    Yes → ApprovalManager.requestApproval()
      │           └──▶ Slack UI with buttons
      │                User clicks Approve/Deny
      │                Resume agent run
      │
      └──▶ Execute with timeout
           Return ToolResult
```

## Collaboration Flow

**Scenario: SEO Engineer needs code review**

```
1. SEO Engineer run triggered (Slack message)
   "I need a backend engineer to review this API spec"

2. Agent calls find_expert tool
   args: { expertise: ["api-design", "backend"] }

3. OrgRegistry.findByExpertise() queries database
   Returns: [{ name: "api-engineer", ... }]

4. Agent calls ask_colleague tool
   args: {
     colleague: "api-engineer",
     message: "Can you review this API spec?",
     channel: "#engineering-team"
   }

5. Message posted to #engineering-team
   "@api-engineer Can you review this API spec?"

6. API Engineer's Slack bot sees the @mention
   Triggers api-engineer.run()

7. API Engineer responds in thread
   Full conversation context maintained
```

## Org Structure Queries

```
OrgRegistry methods:
├── findByExpertise(["kubernetes", "devops"])
│   └──▶ Ranked by matching tags
├── findByRole("Backend engineer")
│   └──▶ All agents with that exact role
├── findByTeam("Engineering")
│   └──▶ Everyone on the team
├── getManager("backend-engineer")
│   └──▶ Project Manager (from reportsTo field)
├── getTeammates("backend-engineer")
│   └──▶ All other Engineering team members
├── getDirectReports("project-manager")
│   └──▶ All agents who report to PM
└── getOrgContext("backend-engineer")
    └──▶ Full hierarchy view: self, manager, teammates, reports
```

## Integration System

```
┌──────────────────────────────────────────────────────────┐
│                 IntegrationRegistry                       │
└──────────────────────────────────────────────────────────┘
       │
       ├──▶ GitHub Integration
       │    └──▶ getTools() → [6 GitHub tools]
       │
       ├──▶ Google Calendar Integration
       │    └──▶ getTools() → [3 Calendar tools]
       │
       └──▶ ... (7 more integrations)

Each integration:
• Extends BaseIntegration
• Implements getTools()
• Handles OAuth token refresh (BaseIntegration.ensureToken())
• Makes authenticated API requests (BaseIntegration.apiRequest())
```

**Credential Flow:**
```
Tool executed → BaseIntegration.ensureToken(agentId)
                      │
                      ├──▶ CredentialStore.getCredential()
                      │    └──▶ DB lookup (agent-specific or global)
                      │
                      ├──▶ Check: expired?
                      │    Yes → refreshToken()
                      │         → Update DB
                      │
                      └──▶ Return access token

Tool makes API request with token
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Azure AKS                            │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Employee Pod │  │ Employee Pod │  │ Employee Pod │ ...  │
│  │ SEO Engineer │  │ Backend Engr │  │ Project Mgr  │      │
│  │              │  │              │  │              │      │
│  │ • 1 process  │  │ • 1 process  │  │ • 1 process  │      │
│  │ • Stateless  │  │ • Stateless  │  │ • Stateless  │      │
│  │ • Socket Mode│  │ • Socket Mode│  │ • Socket Mode│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                 │                │
│         └─────────────────┴─────────────────┘                │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
      ┌────────────────────────────────────────┐
      │         Shared Services                 │
      │                                         │
      │  ┌─────────────┐    ┌─────────────┐   │
      │  │ Neon        │    │ Slack       │   │
      │  │ Postgres    │    │ (per-bot    │   │
      │  │ + pgvector  │    │  socket)    │   │
      │  └─────────────┘    └─────────────┘   │
      └────────────────────────────────────────┘
```

**Scaling:**
- Each employee = 1 pod
- Stateless (all state in Neon)
- Can run multiple replicas if needed
- Socket Mode = no webhooks, no ingress needed
- ArgoCD manages deployments

## Data Model

```sql
agents
├── id, name, displayName, role, team, reportsTo
├── expertise[], canDelegate[]
├── llmProvider, llmModel, systemPrompt
├── tools[], slackChannels[], memoryNamespace
└── enabled, createdAt, updatedAt

conversations
├── id, agentId, externalId, channel, userId
└── startedAt, endedAt

conversation_messages
├── id, conversationId, role, content, toolCalls
└── timestamp

memory_entries
├── id, agentId, namespace, content, embedding (vector)
└── memoryType, metadata, createdAt

task_queue_items
├── id, agentId, taskType, payload, priority
├── status, scheduledFor, attempts, maxRetries
└── createdAt, processedAt

agent_messages
├── id, fromAgentId, toAgentId, messageType
├── content, payload, correlationId, status
└── createdAt

integration_credentials
├── id, agentId, provider, credentialType
├── accessToken, refreshToken, apiKey, expiresAt
├── scopes[], metadata
└── createdAt, updatedAt

webhook_events
├── id, provider, eventType, payload, headers
├── status, error, processedAt
└── createdAt
```

## Event Flow

```
External Trigger → Slack/Cron/Queue/Webhook
        │
        ▼
┌──────────────────────────────────────┐
│ Event Handler                         │
│ • SlackApp handles @mention          │
│ • CronScheduler runs scheduled task  │
│ • TaskQueue polls for pending items  │
│ • WebhookHandler receives webhook    │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ AgentRunner.run()                     │
│ • Acquire per-conversation lock      │
│ • Prevent concurrent runs             │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ BaseAgent.run()                       │
│ [See "Agent Run Loop" above]          │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ EventBus.emit()                       │
│ • 'agent:run:complete'                │
│ • 'tool:executed'                     │
│ • 'approval:requested'                │
│ • 'approval:decided'                  │
└──────────────────────────────────────┘
```

---

## Key Design Principles

1. **Agent Isolation** - Each agent is independent, can be deployed separately
2. **Stateless Execution** - All state in Neon, agents can restart without data loss
3. **Type Safety** - Full TypeScript, Prisma ORM, Zod validation
4. **Provider Agnostic** - Anthropic or OpenAI per agent, unified interface
5. **Memory-Enabled** - Automatic semantic search via pgvector
6. **Collaboration-First** - Built-in org structure and inter-agent tools
7. **Human-in-Loop** - Approval gates for sensitive operations
8. **Integration-Ready** - 9 pre-built integrations + extensible
9. **Production-Grade** - Locking, retries, timeouts, error handling, logging
10. **Slack-Native** - Multi-bot orchestration, threading, rich UI

---

## Performance Characteristics

**Latency:**
- Cold start: ~2-3s (DB connection + embedding init)
- Warm agent run: ~1-5s (depending on LLM call count)
- Tool execution: ~200-1000ms per tool
- Memory search: ~50-100ms (pgvector indexed)

**Throughput:**
- 1 agent can handle ~10-20 concurrent conversations
- Limited by LLM API rate limits, not framework
- Task queue processes ~100 tasks/minute per worker

**Costs:**
- Claude Sonnet: ~$3/M input tokens, ~$15/M output tokens
- GPT-4 Turbo: ~$10/M input tokens, ~$30/M output tokens
- Typical agent run: 2k-5k tokens = $0.01-0.10 per interaction
- pgvector: negligible (included in Neon)

**Scaling:**
- 15 agents = 15 pods @ ~512MB RAM each = 7.5GB total
- Database: single Neon instance handles 100+ agents easily
- Bottleneck: LLM API rate limits (50-500 req/min depending on tier)
