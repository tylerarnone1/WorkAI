# Creating Virtual Employees

This guide shows you how to build AI employees using the `@agents/base` framework.

## Quick Start

Each employee is a separate Node.js project that imports `@agents/base`. Here's the minimal structure:

```
my-employee/
├── package.json
├── .env
├── tsconfig.json
└── src/
    └── index.ts
```

## 1. Project Setup

**package.json:**
```json
{
  "name": "@employees/seo-engineer",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@agents/base": "file:../Base",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

**.env:**
```bash
DATABASE_URL="postgresql://..."
SLACK_SIGNING_SECRET="..."
SLACK_APP_TOKEN="xapp-..."
SLACK_BOT_TOKEN="xoxb-..."
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."
```

## 2. Define Your Employee

**src/index.ts:**
```typescript
import {
  AgentFramework,
  BaseAgent,
  type EmployeeDefinition,
  type BaseAgentDeps,
} from '@agents/base';

// 1. Extend BaseAgent for custom behavior
class SEOEngineer extends BaseAgent {
  // Optional: Override system prompt generation
  protected async buildSystemPrompt(context) {
    const base = await super.buildSystemPrompt(context);
    return `${base}\n\nFocus on SEO strategy, content optimization, and analytics.`;
  }

  // Optional: React to completed runs
  protected async onRunComplete(response, context) {
    console.log(`SEO Engineer completed: ${response.slice(0, 100)}...`);
  }
}

// 2. Define the employee
const seoEngineer: EmployeeDefinition = {
  config: {
    // Identity
    name: 'seo-engineer',
    displayName: 'Sarah (SEO Engineer)',
    avatarUrl: 'https://...',

    // Org Structure
    role: 'SEO engineer',
    team: 'Marketing',
    reportsTo: 'marketing-director',
    expertise: ['seo', 'content-strategy', 'analytics', 'keyword-research'],
    canDelegate: ['social-media-specialist'], // Optional: who they can assign work to

    // AI Configuration
    llmProvider: 'anthropic', // or 'openai'
    llmModel: 'claude-sonnet-4-5-20250929',
    llmTemperature: 0.7,
    llmMaxTokens: 4096,
    maxIterations: 10,

    // System Prompt
    systemPrompt: `You are Sarah, an SEO engineer on the marketing team.

Your responsibilities:
- Conduct keyword research and competitive analysis
- Optimize content for search engines
- Monitor SEO performance and rankings
- Collaborate with content creators on SEO strategy
- Track and report on organic traffic metrics

Guidelines:
- Use find_expert to find colleagues with specific skills
- Use ask_colleague to collaborate via Slack
- Use delegate_task to assign work to team members
- Always provide data-driven recommendations
- Request human approval (use human_approval tool) for major strategy changes`,

    // Tools available to this employee
    tools: [
      'web_search',
      'http_request',
      'memory_search',
      'memory_store',
      'find_expert',
      'ask_colleague',
      'delegate_task',
      'github_list_repos',
      'github_get_file',
      'google_calendar_list_events',
      'clickup_list_tasks',
      'clickup_create_task',
    ],

    // Slack Configuration
    slackChannels: ['#marketing-team', '#seo-updates'],

    // Memory
    memoryNamespace: 'seo-engineer',

    // Scheduled Tasks (optional)
    scheduledTasks: [
      {
        name: 'weekly-seo-report',
        cronExpression: '0 9 * * 1', // Monday 9am
        taskType: 'report',
        payload: { type: 'weekly_seo_metrics' },
        enabled: true,
      },
    ],
  },

  // Integrations this employee needs
  integrations: [
    { provider: 'github', enabled: true },
    { provider: 'google_calendar', enabled: true },
    { provider: 'clickup', enabled: true },
  ],

  // Factory function to create the agent instance
  createAgent: (deps: BaseAgentDeps) => new SEOEngineer(deps),
};

// 3. Boot the framework
const framework = new AgentFramework();
await framework.boot([seoEngineer]);
```

## 3. Organization Structure

### Teams
Define clear team boundaries:
- **Marketing**: Head of GTM, Marketing director, SEO engineer, Social Media specialist
- **Engineering**: Backend, API, Data, UX, Frontend, Project Manager, SecOps
- **Operations**: Operations Manager, Executive assistant, Business Dev, Strategist

### Reporting Lines
```typescript
{
  reportsTo: 'marketing-director', // Direct manager
}
```

This enables:
- Automatic escalation paths
- Org chart queries
- Manager notifications

### Expertise Tags
```typescript
{
  expertise: [
    'seo',              // Primary domain
    'analytics',        // Tooling
    'content-strategy', // Process knowledge
    'keyword-research', // Specific skill
  ],
}
```

Used by `find_expert` for skill-based discovery.

### Delegation Rights
```typescript
{
  canDelegate: ['social-media-specialist', 'content-writer'],
}
```

If specified, `delegate_task` enforces this whitelist. If omitted, can delegate to anyone.

## 4. Tool Selection Guide

### Base Tools (always available)
- `web_search` - Search the web for information
- `http_request` - Make HTTP requests to APIs
- `memory_search` - Search agent's memory
- `memory_store` - Store information in memory
- `human_approval` - Request human approval for sensitive actions

### Collaboration Tools (always available)
- `find_expert` - Find colleagues by skill/role/team
- `ask_colleague` - DM or mention a colleague in Slack
- `delegate_task` - Assign work to another agent
- `agent_message` - Send structured messages between agents

### Integration Tools
**GitHub:**
- `github_list_repos`, `github_create_issue`, `github_list_prs`, `github_comment_pr`, `github_get_file`, `github_create_pr`

**Google Calendar:**
- `calendar_list_events`, `calendar_create_event`, `calendar_free_busy`

**Google Drive:**
- `drive_search`, `drive_get_file`, `drive_list_files`, `drive_create_file`

**Gmail:**
- `gmail_list_messages`, `gmail_read_message`, `gmail_send`, `gmail_search`

**ClickUp:**
- `clickup_get_spaces`, `clickup_list_tasks`, `clickup_get_task`, `clickup_create_task`, `clickup_update_task`, `clickup_add_comment`

**Figma:**
- `figma_get_file`, `figma_get_comments`, `figma_post_comment`, `figma_get_components`

**Jira:**
- `jira_search`, `jira_get_issue`, `jira_create_issue`, `jira_update_issue`, `jira_add_comment`, `jira_transition_issue`

**HubSpot:**
- `hubspot_search_contacts`, `hubspot_get_contact`, `hubspot_create_contact`, `hubspot_search_deals`, `hubspot_create_deal`, `hubspot_get_company`

**ArgoCD:**
- `argocd_list_apps`, `argocd_get_app`, `argocd_sync_app`, `argocd_app_health`, `argocd_rollback`

## 5. LLM Provider Selection

### When to use Anthropic (Claude)
- **Development & coding tasks** - Claude excels at code generation, refactoring, debugging
- **Technical writing** - Documentation, technical specs, API docs
- **Complex reasoning** - Multi-step problem solving, architectural decisions
- **Long context tasks** - Analyzing large codebases or documents

**Recommended roles:** Backend Engineer, API Engineer, Data Engineer, Frontend Engineer, Technical Writer

### When to use OpenAI (GPT)
- **Creative tasks** - Marketing copy, social media content, brainstorming
- **Business strategy** - Market analysis, competitive research, planning
- **Customer communication** - Support responses, sales outreach
- **Quick tasks** - Simple Q&A, data extraction, summarization

**Recommended roles:** Marketing Director, SEO Engineer, Social Media Specialist, Business Development, Strategist

## 6. Memory Configuration

Each employee has isolated memory via `memoryNamespace`:

```typescript
{
  memoryNamespace: 'seo-engineer', // Unique per employee
}
```

**Shared memory** is available via the `SharedMemory` class for cross-agent knowledge.

Memory is automatically:
- Stored with embeddings (pgvector)
- Searched semantically when relevant
- Injected into context for each run

## 7. Integration Configuration

### OAuth Setup (GitHub, Google, ClickUp, Figma, Jira, HubSpot)

1. **Create OAuth app** in the provider's developer portal
2. **Get credentials** (client ID, client secret)
3. **Implement OAuth flow** (outside this framework - use a web server)
4. **Store tokens** in the database:

```typescript
import { CredentialStore } from '@agents/base';

const credStore = new CredentialStore(prisma);

await credStore.storeOAuth('github', {
  accessToken: 'gho_...',
  refreshToken: 'ghr_...',
  expiresAt: new Date('2025-01-01'),
  scopes: ['repo', 'read:user'],
}, 'seo-engineer'); // Agent-specific, or omit for global
```

### API Key Setup (ArgoCD, custom services)

```typescript
await credStore.storeApiKey('argocd', 'your-api-token', 'devops-engineer');
```

### Provider-Specific Config

**Jira & ArgoCD** require `baseUrl` in credential metadata:

```typescript
await credStore.storeOAuth('jira', tokens, 'project-manager');

// Then update the credential record to add metadata
await prisma.integrationCredential.update({
  where: { agentId_provider: { agentId: agentId, provider: 'jira' } },
  data: { metadata: { baseUrl: 'https://yourorg.atlassian.net' } },
});
```

## 8. Slack Setup

### Per-Employee Bot

Each employee needs its own Slack bot:

1. Create app at https://api.slack.com/apps
2. Enable **Socket Mode** and get `SLACK_APP_TOKEN`
3. Add bot token scopes: `app_mentions:read`, `chat:write`, `channels:history`, `channels:read`, `groups:history`, `im:history`, `im:write`
4. Get `SLACK_BOT_TOKEN`
5. Install app to workspace

### Channel Subscriptions

```typescript
{
  slackChannels: ['#marketing-team', '#seo-updates'],
}
```

The employee will:
- Listen for @mentions in these channels
- Respond to DMs
- Post updates and collaborate

## 9. Scheduled Tasks

Run periodic tasks automatically:

```typescript
{
  scheduledTasks: [
    {
      name: 'daily-standup',
      cronExpression: '0 9 * * 1-5', // Weekdays at 9am
      taskType: 'standup',
      payload: { channel: '#engineering-team' },
      enabled: true,
    },
    {
      name: 'weekly-metrics',
      cronExpression: '0 17 * * 5', // Friday 5pm
      taskType: 'report',
      payload: { type: 'weekly_summary' },
      enabled: true,
    },
  ],
}
```

**Cron syntax:**
```
*    *    *    *    *
┬    ┬    ┬    ┬    ┬
│    │    │    │    └─ day of week (0-7, 0=Sunday)
│    │    │    └────── month (1-12)
│    │    └─────────── day of month (1-31)
│    └──────────────── hour (0-23)
└───────────────────── minute (0-59)
```

## 10. Custom Tools

Add employee-specific tools:

```typescript
import { ITool, ToolDefinition, ToolResult } from '@agents/base';

class CustomAnalyticsTool implements ITool {
  definition: ToolDefinition = {
    name: 'fetch_analytics',
    description: 'Fetch SEO analytics from our internal dashboard',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string' },
        endDate: { type: 'string' },
      },
      required: ['startDate', 'endDate'],
    },
    category: 'analytics',
  };

  async execute(args, context): Promise<ToolResult> {
    // Your custom logic
    const data = await fetchFromAPI(args.startDate, args.endDate);
    return { success: true, output: JSON.stringify(data) };
  }
}

// Add to employee definition
const employee: EmployeeDefinition = {
  config: { /* ... */ },
  customTools: [new CustomAnalyticsTool()],
  createAgent: (deps) => new MyAgent(deps),
};
```

## 11. Advanced: Custom Agent Behavior

Override extension points in your agent class:

```typescript
class AdvancedAgent extends BaseAgent {
  // Customize system prompt dynamically
  protected async buildSystemPrompt(context) {
    const base = await super.buildSystemPrompt(context);
    const time = new Date().getHours();
    const greeting = time < 12 ? 'Good morning' : 'Good afternoon';
    return `${base}\n\n${greeting}! Current priority: ${this.getCurrentPriority()}`;
  }

  // Intercept messages before LLM call
  protected async beforeLLMCall(messages, context) {
    // Add custom context, filter messages, etc.
    return messages;
  }

  // React to run completion
  protected async onRunComplete(response, context) {
    await this.logToAnalytics(response, context);
    await this.notifyManager(response);
  }

  // Handle tool errors
  protected async onToolError(toolName, error, context) {
    if (toolName === 'critical_tool') {
      await this.escalate(error);
    }
  }

  private getCurrentPriority() {
    // Your custom logic
    return 'customer-facing tasks';
  }
}
```

## 12. Example: Full Marketing Team

```typescript
const marketingTeam: EmployeeDefinition[] = [
  {
    config: {
      name: 'head-of-gtm',
      displayName: 'Alex (Head of GTM)',
      role: 'Head of GTM',
      team: 'Marketing',
      reportsTo: 'ceo',
      expertise: ['go-to-market', 'strategy', 'leadership', 'b2b-saas'],
      canDelegate: ['marketing-director', 'seo-engineer', 'social-media-specialist'],
      llmProvider: 'openai',
      llmModel: 'gpt-4-turbo',
      systemPrompt: `You lead marketing strategy and execution...`,
      tools: ['web_search', 'find_expert', 'delegate_task', 'hubspot_search_deals'],
      slackChannels: ['#marketing-team', '#leadership'],
      memoryNamespace: 'head-of-gtm',
      scheduledTasks: [],
    },
    integrations: [{ provider: 'hubspot', enabled: true }],
    createAgent: (deps) => new BaseAgent(deps),
  },
  {
    config: {
      name: 'marketing-director',
      displayName: 'Jordan (Marketing Director)',
      role: 'Marketing director',
      team: 'Marketing',
      reportsTo: 'head-of-gtm',
      expertise: ['marketing-ops', 'campaign-management', 'analytics', 'content-strategy'],
      canDelegate: ['seo-engineer', 'social-media-specialist'],
      llmProvider: 'openai',
      llmModel: 'gpt-4-turbo',
      systemPrompt: `You manage day-to-day marketing operations...`,
      tools: ['web_search', 'find_expert', 'delegate_task', 'clickup_list_tasks', 'clickup_create_task'],
      slackChannels: ['#marketing-team'],
      memoryNamespace: 'marketing-director',
      scheduledTasks: [
        {
          name: 'weekly-campaign-review',
          cronExpression: '0 10 * * 1',
          taskType: 'review',
          payload: { type: 'campaigns' },
          enabled: true,
        },
      ],
    },
    integrations: [{ provider: 'clickup', enabled: true }],
    createAgent: (deps) => new BaseAgent(deps),
  },
  // ... seo-engineer, social-media-specialist
];

await framework.boot(marketingTeam);
```

## 13. Database Migrations

After modifying the Prisma schema, run:

```bash
npx prisma generate
npx prisma migrate dev --name your_migration_name
```

## 14. Running Your Employees

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

**With PM2:**
```bash
pm2 start dist/index.js --name seo-engineer
```

**Docker:**
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

**Kubernetes:**
Deploy via ArgoCD with your existing Azure/AKS pipeline.

## 15. Monitoring & Debugging

**Health Check:**
```bash
curl http://localhost:3001/health
```

**Logs:**
All agents use Pino for structured JSON logging. Configure log level via `LOG_LEVEL` env var.

**Database Queries:**
Use Prisma Studio to inspect agent state, conversations, memories:
```bash
npx prisma studio
```

---

## Quick Reference: Full Employee Template

```typescript
import { AgentFramework, BaseAgent, type EmployeeDefinition } from '@agents/base';

class MyEmployee extends BaseAgent {
  // Optional: custom behavior
}

const employee: EmployeeDefinition = {
  config: {
    name: 'agent-name',
    displayName: 'Name (Role)',
    role: 'Job Title',
    team: 'Team Name',
    reportsTo: 'manager-name',
    expertise: ['skill1', 'skill2'],
    canDelegate: ['other-agent'], // optional
    llmProvider: 'anthropic', // or 'openai'
    llmModel: 'claude-sonnet-4-5-20250929',
    llmTemperature: 0.7,
    llmMaxTokens: 4096,
    maxIterations: 10,
    systemPrompt: `Your role and instructions...`,
    tools: ['web_search', 'find_expert', 'ask_colleague'],
    slackChannels: ['#team-channel'],
    memoryNamespace: 'unique-namespace',
    scheduledTasks: [],
  },
  integrations: [{ provider: 'github', enabled: true }],
  customTools: [],
  createAgent: (deps) => new MyEmployee(deps),
};

const framework = new AgentFramework();
await framework.boot([employee]);
```

---

**Next Steps:**
1. Set up Neon database
2. Configure Slack bots
3. Store integration credentials
4. Define your first employee
5. Run `npm run dev`
6. Watch your virtual company come to life!
