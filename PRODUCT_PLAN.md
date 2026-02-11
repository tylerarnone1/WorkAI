# Product Plan: AI Employee Hiring Platform

## Vision

Transform `@agents/base` from a developer framework into a **SaaS platform where anyone can build a virtual AI workforce** through an intuitive hiring experience. Users "interview" AI candidates with different backgrounds, personalities, and working styles, then watch them collaborate in Slack.

**Tagline:** *"Hire AI employees that actually work together"*

---

## Core Concept

### The Problem
Building AI agents requires:
- Writing code
- Understanding LLM APIs
- Configuring system prompts
- Setting up infrastructure

**Result:** Only developers can build AI teams.

### The Solution
**Visual hiring interface** where users:
1. Select a role (SEO Engineer, Backend Engineer, etc.)
2. See 3 AI-generated "resumes" with different backgrounds
3. Hire their favorite → Agent is created and deployed
4. Watch them work in Slack

**No code required.**

### The Magic
Each background creates a **distinct personality**:
- Energy sector veteran = analytical, risk-averse, ROI-focused
- Consumer tech innovator = creative, fast-moving, user-obsessed
- Agency all-rounder = versatile, process-driven, client-facing

The AI truly behaves differently based on their "resume."

---

## Product Features

### Phase 1: Core Hiring Experience (MVP - Week 1-2)

#### 1.1 Role Templates
**15 pre-built roles across 3 teams:**

**Marketing (5 roles):**
- Head of GTM
- Marketing Director
- SEO Engineer
- Content Strategist
- Social Media Manager

**Engineering (7 roles):**
- Backend Engineer
- Frontend Engineer
- API Engineer
- Data Engineer
- DevOps Engineer
- UX Designer
- Project Manager

**Operations (3 roles):**
- Operations Manager
- Executive Assistant
- Business Development Manager

Each template includes:
- Base system prompt
- Default tool set
- Required expertise tags
- Team assignment
- Reporting structure

#### 1.2 Background Library
**3 backgrounds per role = 45 unique combinations**

**Example: SEO Engineer backgrounds**
1. **Energy Sector Veteran**
   - Industry: Energy, utilities, industrial B2B
   - Personality: Analytical, methodical, risk-averse
   - Expertise boost: Technical SEO, compliance, B2B content
   - Working style: Data-driven, conservative strategies, ROI-focused

2. **Consumer Tech Innovator**
   - Industry: Consumer tech, SaaS startups
   - Personality: Creative, user-obsessed, experimental
   - Expertise boost: Growth hacking, viral content, A/B testing
   - Working style: Fast iteration, user-first, creative tactics

3. **Agency All-Rounder**
   - Industry: SEO agencies, consulting
   - Personality: Versatile, communicative, pragmatic
   - Expertise boost: Multi-industry SEO, client management, documentation
   - Working style: Adaptable, process-oriented, clear communication

#### 1.3 AI Resume Generator
**Generate realistic resumes for each role + background combo:**
- Realistic name (diverse)
- 2-3 previous companies (real companies in that industry)
- 3-5 achievements (with metrics)
- Years of experience
- Summary of working style
- Personality traits

**Example generated resume:**
```
Name: Sarah Chen
Background: Energy Sector Veteran

Experience:
- SEO Manager @ Shell Energy (2019-2024)
  • Increased organic traffic 340% for B2B energy solutions
  • Built technical SEO frameworks for compliance-heavy content
  • Managed $2M annual SEO budget with strict ROI requirements

- Digital Marketing Lead @ Siemens (2016-2019)
  • Led SEO for industrial automation products
  • Expertise in technical B2B keyword research

Working Style: Analytical, data-driven, focused on ROI. Prefers
proven strategies over experimental tactics.

Personality: Methodical • Risk-averse • Detail-oriented
```

#### 1.4 Hiring UI Flow

**Step 1: Dashboard**
- View all hired employees
- See team composition
- "Hire New Employee" button

**Step 2: Role Selection**
- Grid of 15 roles with icons
- Category filters (Marketing, Engineering, Operations)
- Click role → See 3 candidates

**Step 3: Candidate Review**
- Side-by-side comparison of 3 resumes
- Expandable sections (Experience, Skills, Personality)
- "Interview" button → AI-generated Q&A preview (future phase)
- "Hire" button

**Step 4: Onboarding**
- Configure agent name (or use generated name)
- Select Slack channels
- Assign manager (if not default)
- Optional: Add custom instructions
- "Deploy Employee" button

**Step 5: Confirmation**
- "Meet [Name]!" screen
- Link to Slack channel
- Suggested first task
- Redirect to dashboard

#### 1.5 Employee Dashboard

**Main view:**
```
+----------------------------------------------------------+
| Your Team                                    [+Hire New] |
+----------------------------------------------------------+
| Marketing (3/5)          Engineering (4/7)   Operations  |
| ┌─────────────────┐     ┌─────────────────┐  (2/3)      |
| │ 🔍 Sarah Chen   │     │ ⚙️ Alex Kumar    │             |
| │ SEO Engineer    │     │ Backend Engineer │  [View All] |
| │ Active • 12 hrs │     │ Active • 3 hrs   │             |
| └─────────────────┘     └─────────────────┘             |
+----------------------------------------------------------+
| Recent Activity                                          |
| • Sarah completed "Keyword research for Q1 campaign"     |
| • Alex pushed fix to production                          |
| • Jordan scheduled meeting with Design team              |
+----------------------------------------------------------+
```

**Employee detail page:**
- Resume
- Current tasks
- Recent conversations
- Performance metrics (tasks completed, avg response time)
- Edit configuration
- Pause/Unpause
- Terminate employment

---

### Phase 2: Advanced Features (Week 3-4)

#### 2.1 AI Interview Preview
Before hiring, user can "interview" candidates:
- Click "Interview" button
- AI generates 3 sample Q&A exchanges showing personality
- Example: "How would you approach a new SEO project?"
  - Energy veteran: "First, I'd analyze current rankings and set clear ROI targets..."
  - Consumer tech: "I'd look at what competitors are doing that's working and iterate fast..."
  - Agency: "I'd start with a comprehensive audit and create a prioritized roadmap..."

#### 2.2 Custom Backgrounds
Users can create custom backgrounds:
- Name & description
- Industry focus
- Personality traits (select from list)
- Working style description
- Additional expertise tags

#### 2.3 Team Templates
Pre-built team compositions:
- "Marketing Launch Squad" (GTM lead + SEO + Social + Content)
- "Full-Stack Dev Team" (Backend + Frontend + DevOps + PM)
- "Growth Team" (Marketing director + SEO + Data engineer + BizDev)

One-click hiring of entire teams.

#### 2.4 Performance Analytics
Dashboard showing:
- Tasks completed per agent
- Collaboration patterns (who works with whom)
- Response time metrics
- Tool usage breakdown
- Cost per agent (LLM API costs)

#### 2.5 Agent Training
Users can provide feedback:
- Thumbs up/down on agent responses
- Add notes to agent's memory
- Adjust system prompt through UI
- Upload documents for agent to learn from

---

### Phase 3: Enterprise Features (Week 5-6)

#### 3.1 Multi-Workspace
- Multiple companies/projects
- Isolated employee teams per workspace
- Shared employee library (templates)

#### 3.2 Role-Based Access Control
- Admin: Full access
- Manager: Hire/manage own team
- Member: View-only

#### 3.3 SSO & Enterprise Auth
- SAML/OKTA integration
- Team invitations
- Audit logs

#### 3.4 Advanced Integrations
- Custom tool builder (UI for creating tools)
- Webhook configuration
- API access for programmatic control

#### 3.5 White-Label
- Custom branding
- Custom domain
- Hide "Built with @agents/base" footer

---

## Technical Architecture

### Database Schema Additions

```prisma
// ============================================================================
// TEMPLATES & BACKGROUNDS
// ============================================================================

model RoleTemplate {
  id                String   @id @default(uuid())
  role              String   // "SEO Engineer"
  slug              String   @unique // "seo-engineer"
  category          String   // "Marketing", "Engineering", "Operations"
  team              String   // Team assignment
  reportsTo         String?  @map("reports_to") // Default manager role
  icon              String   // Emoji or icon URL
  description       String   @db.Text
  baseSystemPrompt  String   @map("base_system_prompt") @db.Text
  defaultTools      String[] @default([]) @map("default_tools")
  requiredExpertise String[] @default([]) @map("required_expertise")
  priority          Int      @default(0) // Display order
  enabled           Boolean  @default(true)
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  backgrounds       Background[]
  hiredAgents       HiredAgent[]

  @@map("role_templates")
}

model Background {
  id                String   @id @default(uuid())
  templateId        String   @map("template_id")
  name              String   // "Energy Sector Veteran"
  slug              String   // "energy-sector"
  industry          String   // "energy"
  description       String   @db.Text
  personalityTraits String[] @default([]) @map("personality_traits")
  workingStyle      String   @map("working_style") @db.Text
  promptModifiers   String   @map("prompt_modifiers") @db.Text
  expertiseBoost    String[] @default([]) @map("expertise_boost")
  priority          Int      @default(0)
  enabled           Boolean  @default(true)
  createdAt         DateTime @default(now()) @map("created_at")

  template          RoleTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  hiredAgents       HiredAgent[]

  @@unique([templateId, slug])
  @@map("backgrounds")
}

model HiredAgent {
  id              String   @id @default(uuid())
  workspaceId     String?  @map("workspace_id") // For multi-workspace support
  agentId         String   @unique @map("agent_id")
  templateId      String   @map("template_id")
  backgroundId    String   @map("background_id")
  generatedName   String   @map("generated_name")
  generatedResume Json     @map("generated_resume") // Full resume object
  customizations  Json?    // User tweaks
  status          String   @default("active") // active, paused, terminated
  hiredAt         DateTime @default(now()) @map("hired_at")
  hiredBy         String?  @map("hired_by") // User ID
  terminatedAt    DateTime? @map("terminated_at")

  agent           Agent           @relation(fields: [agentId], references: [id], onDelete: Cascade)
  template        RoleTemplate    @relation(fields: [templateId], references: [id])
  background      Background      @relation(fields: [backgroundId], references: [id])

  @@index([workspaceId, status])
  @@map("hired_agents")
}

// Update existing Agent model to add HiredAgent relation
model Agent {
  // ... existing fields ...
  hiredAgent      HiredAgent?
}

// ============================================================================
// USER MANAGEMENT (for Phase 3)
// ============================================================================

model Workspace {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  ownerId     String   @map("owner_id")
  plan        String   @default("free") // free, pro, enterprise
  maxAgents   Int      @default(5) @map("max_agents")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("workspaces")
}

model User {
  id          String   @id @default(uuid())
  email       String   @unique
  name        String?
  avatarUrl   String?  @map("avatar_url")
  role        String   @default("member") // admin, manager, member
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("users")
}
```

### Directory Structure

```
src/
├── framework/         # Existing core framework
├── agent/            # Existing agent system
├── templates/        # NEW: Role templates + backgrounds
│   ├── types.ts
│   ├── loader.ts
│   ├── roles/
│   │   ├── marketing/
│   │   │   ├── seo-engineer.ts
│   │   │   ├── content-strategist.ts
│   │   │   └── social-media-manager.ts
│   │   ├── engineering/
│   │   │   ├── backend-engineer.ts
│   │   │   ├── frontend-engineer.ts
│   │   │   └── ...
│   │   └── operations/
│   │       └── ...
│   └── backgrounds/
│       ├── energy-sector.ts
│       ├── consumer-tech.ts
│       ├── agency-experience.ts
│       ├── big-tech.ts
│       ├── startup.ts
│       └── ...
├── hiring/           # NEW: Hiring system
│   ├── resume-generator.ts
│   ├── agent-factory.ts
│   └── dynamic-loader.ts
└── ui/               # NEW: Web interface
    ├── app/          # Next.js 14 App Router
    │   ├── layout.tsx
    │   ├── page.tsx           # Dashboard
    │   ├── hire/
    │   │   └── page.tsx       # Hiring flow
    │   ├── employees/
    │   │   ├── page.tsx       # Employee list
    │   │   └── [id]/page.tsx  # Employee detail
    │   └── api/
    │       ├── agents/
    │       │   ├── hire/route.ts
    │       │   ├── [id]/route.ts
    │       │   └── [id]/pause/route.ts
    │       ├── templates/route.ts
    │       └── resumes/generate/route.ts
    ├── components/
    │   ├── RoleGrid.tsx
    │   ├── CandidateCard.tsx
    │   ├── EmployeeCard.tsx
    │   └── ...
    └── lib/
        ├── api-client.ts
        └── types.ts
```

---

## Execution Environments for Development Agents

### The Problem

Engineering roles (Frontend, Backend, DevOps, etc.) need to **actually do development work**, which means they need:
- A shell environment where `cd`, `npm install`, and state persists across commands
- Ability to run servers and see the output
- Browser automation to view rendered UIs (critical for Frontend Engineer)
- File system operations (read, write, watch)
- Port management (each agent gets isolated port ranges)
- Screenshot capability so agents can "see" what users will see

**Without this, Frontend Engineers can write React code but never see if it works. Backend Engineers can write APIs but never test them.**

### Solution: Docker Containers Per Agent

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Agent Framework (Node.js host)                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Frontend Engineer Agent                                │ │
│  │ ┌────────────────────────────────────────────────────┐ │ │
│  │ │ Docker Container (isolated environment)            │ │ │
│  │ │                                                      │ │ │
│  │ │  • Persistent bash session (cd, npm i persists)    │ │ │
│  │ │  • Node.js 22 + pnpm/npm                           │ │ │
│  │ │  • Playwright + Chrome (for screenshot/preview)    │ │ │
│  │ │  • Git                                             │ │ │
│  │ │  • Port range: 3000-3009 (dev servers)            │ │ │
│  │ │  • Volume: /workspace → agent's project files     │ │ │
│  │ │                                                      │ │ │
│  │ └────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Backend Engineer Agent                                 │ │
│  │ ┌────────────────────────────────────────────────────┐ │ │
│  │ │ Docker Container                                   │ │ │
│  │ │                                                      │ │ │
│  │ │  • Persistent bash session                         │ │ │
│  │ │  • Node.js + Python + Go (multi-runtime)           │ │ │
│  │ │  • Docker CLI (for building images)                │ │ │
│  │ │  • Port range: 4000-4009 (API servers)            │ │ │
│  │ │  • Volume: /workspace → agent's project files     │ │ │
│  │ │                                                      │ │ │
│  │ └────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Base Image

**Dockerfile:**
```dockerfile
FROM node:22-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    python3-pip \
    golang-1.19 \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright with Chrome
RUN npm install -g playwright && \
    playwright install chromium --with-deps

# Install pnpm
RUN npm install -g pnpm

# Create workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace

# Keep container running
CMD ["tail", "-f", "/dev/null"]
```

**Image variants:**
- `agent-runtime-node` — Frontend, Backend, API engineers
- `agent-runtime-python` — Data engineers (includes Jupyter, pandas)
- `agent-runtime-fullstack` — Full-stack roles (Node + Python + Go)

### Enhanced Tool System

#### 1. PersistentBashTool

**Problem:** Standard bash execution loses state. Running `cd frontend` then `npm start` won't work because `cd` state is lost.

**Solution:** Maintain a persistent bash session per container.

```typescript
interface PersistentBashToolArgs {
  command: string;
  workingDirectory?: string; // Optional override
  timeout?: number;
  captureOutput?: boolean;
}

class PersistentBashTool implements ITool {
  private containerSessions: Map<string, DockerExecSession> = new Map();

  async execute(args: PersistentBashToolArgs, context: ToolExecutionContext) {
    const session = this.getOrCreateSession(context.agentId);

    // Execute in persistent session
    const result = await session.exec(args.command, {
      timeout: args.timeout ?? 120000,
      captureStdout: args.captureOutput ?? true,
      captureStderr: true,
    });

    return {
      success: result.exitCode === 0,
      output: `Exit code: ${result.exitCode}\n\n${result.stdout}\n${result.stderr}`,
      exitCode: result.exitCode,
    };
  }

  private getOrCreateSession(agentId: string): DockerExecSession {
    if (!this.containerSessions.has(agentId)) {
      const containerName = `agent-${agentId}`;
      this.containerSessions.set(agentId, new DockerExecSession(containerName));
    }
    return this.containerSessions.get(agentId)!;
  }
}
```

**Example usage by agent:**
```
1. Agent: run_bash({ command: "cd /workspace/frontend" })
2. Agent: run_bash({ command: "npm install" })
3. Agent: run_bash({ command: "npm run dev" })
   → Dev server starts on port 3000 (within agent's port range)
```

#### 2. BrowserTool

**Problem:** Frontend engineers can't see what they're building.

**Solution:** Playwright automation for screenshots and UI testing.

```typescript
interface BrowserToolArgs {
  action: 'screenshot' | 'navigate' | 'click' | 'type' | 'evaluate';
  url?: string;
  selector?: string;
  value?: string;
  script?: string;
  waitForSelector?: string;
  viewport?: { width: number; height: number };
}

class BrowserTool implements ITool {
  async execute(args: BrowserToolArgs, context: ToolExecutionContext) {
    const containerName = `agent-${context.agentId}`;

    switch (args.action) {
      case 'screenshot':
        // Take screenshot of running dev server
        const screenshotPath = await this.takeScreenshot({
          containerName,
          url: args.url ?? 'http://localhost:3000',
          viewport: args.viewport ?? { width: 1280, height: 720 },
          waitForSelector: args.waitForSelector,
        });

        return {
          success: true,
          output: `Screenshot saved: ${screenshotPath}`,
          screenshotPath,
        };

      case 'evaluate':
        // Run JavaScript in browser context
        const result = await this.evaluateScript({
          containerName,
          url: args.url!,
          script: args.script!,
        });

        return {
          success: true,
          output: JSON.stringify(result, null, 2),
        };

      // ... other actions
    }
  }
}
```

**Example workflow for Frontend Engineer:**
```
1. Agent: run_bash({ command: "npm run dev" })
   → "Server started on http://localhost:3000"

2. Agent: browser_tool({ action: 'screenshot', url: 'http://localhost:3000' })
   → Screenshot returned to agent via LLM message

3. Agent sees screenshot, identifies bug in button styling

4. Agent: file_write({ path: 'src/Button.css', content: '...' })

5. Agent: browser_tool({ action: 'screenshot', url: 'http://localhost:3000' })
   → Verify fix worked
```

#### 3. FileSystemTools

Enhanced file operations beyond basic read/write:

```typescript
// file_read - Read file contents (already exists, enhanced with syntax highlighting)
// file_write - Write file contents (already exists)
// file_tree - Show directory structure
// file_watch - Watch for file changes (useful for hot reload detection)
// file_search - Search file contents (ripgrep wrapper)

interface FileTreeToolArgs {
  path: string;
  maxDepth?: number;
  includePattern?: string; // glob pattern
  excludePattern?: string;
}

interface FileWatchToolArgs {
  path: string;
  duration: number; // seconds
  pattern?: string;
}
```

**Example usage:**
```
Agent: file_tree({ path: '/workspace/frontend/src', maxDepth: 2 })
→ Shows component structure

Agent: file_watch({ path: 'src/components', duration: 5, pattern: '*.tsx' })
→ "2 files changed: Button.tsx, Header.tsx"
```

#### 4. PortManagementTool

**Problem:** Multiple agents running servers need isolated ports.

**Solution:** Allocate port ranges per agent role.

```typescript
interface PortAllocation {
  agentId: string;
  role: string;
  portRange: { start: number; end: number };
  allocatedPorts: Array<{ port: number; service: string; pid?: number }>;
}

class PortManagementTool implements ITool {
  private allocations: Map<string, PortAllocation> = new Map();

  async execute(args: { action: 'allocate' | 'release' | 'list'; service?: string }, context: ToolExecutionContext) {
    const allocation = this.getOrCreateAllocation(context.agentId, context.agentRole);

    switch (args.action) {
      case 'allocate':
        const port = this.findAvailablePort(allocation.portRange);
        allocation.allocatedPorts.push({ port, service: args.service ?? 'unknown' });

        return {
          success: true,
          output: `Allocated port ${port} for ${args.service}. Use: http://localhost:${port}`,
          port,
        };

      case 'list':
        return {
          success: true,
          output: JSON.stringify(allocation.allocatedPorts, null, 2),
        };

      // ... release logic
    }
  }

  private getOrCreateAllocation(agentId: string, role: string): PortAllocation {
    if (!this.allocations.has(agentId)) {
      this.allocations.set(agentId, {
        agentId,
        role,
        portRange: this.getPortRangeForRole(role),
        allocatedPorts: [],
      });
    }
    return this.allocations.get(agentId)!;
  }

  private getPortRangeForRole(role: string): { start: number; end: number } {
    const ranges: Record<string, { start: number; end: number }> = {
      'frontend-engineer': { start: 3000, end: 3099 },
      'backend-engineer': { start: 4000, end: 4099 },
      'api-engineer': { start: 5000, end: 5099 },
      'data-engineer': { start: 8000, end: 8099 },
      'devops-engineer': { start: 9000, end: 9099 },
    };
    return ranges[role] ?? { start: 7000, end: 7099 };
  }
}
```

**Example usage:**
```
Agent: port_management({ action: 'allocate', service: 'vite-dev-server' })
→ "Allocated port 3000. Use: http://localhost:3000"

Agent: run_bash({ command: "npm run dev -- --port 3000" })
```

### Workspace Directory Structure

Each agent gets isolated workspace:

```
/agent-workspaces/
├── frontend-engineer-abc123/
│   ├── projects/                    # Git repos agent works on
│   │   ├── company-website/
│   │   └── admin-dashboard/
│   ├── .bash_history                # Persisted shell history
│   ├── .bashrc                      # Custom shell config
│   ├── ports.json                   # Allocated ports
│   └── screenshots/                 # Browser screenshots
│       ├── homepage-2024-02-09-14-30.png
│       └── checkout-flow-2024-02-09-15-00.png
│
├── backend-engineer-def456/
│   ├── projects/
│   │   └── api-service/
│   ├── .bash_history
│   ├── ports.json
│   └── logs/
│       ├── server.log
│       └── test-results.log
│
└── seo-engineer-ghi789/
    └── research/                    # Non-dev agents don't need containers
        └── keyword-analysis.csv
```

**Volume mounts:**
```yaml
# docker-compose.yml
services:
  agent-frontend-engineer-abc123:
    image: agent-runtime-node:latest
    volumes:
      - ./agent-workspaces/frontend-engineer-abc123:/workspace
    ports:
      - "3000-3099:3000-3099"  # Expose agent's port range
    environment:
      - AGENT_ID=abc123
      - AGENT_ROLE=frontend-engineer
```

### Container Lifecycle Management

#### Provisioning

When a development agent is hired:

```typescript
class ContainerProvisioner {
  async provisionForAgent(agent: Agent): Promise<ContainerInfo> {
    const needsContainer = this.isDevelopmentRole(agent.role);
    if (!needsContainer) return null;

    // Create workspace directory
    const workspacePath = `/agent-workspaces/${agent.name}-${agent.id}`;
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.mkdir(`${workspacePath}/projects`, { recursive: true });
    await fs.mkdir(`${workspacePath}/screenshots`, { recursive: true });

    // Determine image based on role
    const image = this.getImageForRole(agent.role);
    const portRange = this.getPortRangeForRole(agent.role);

    // Start container
    const containerName = `agent-${agent.id}`;
    await dockerClient.createContainer({
      name: containerName,
      image,
      volumes: [{ host: workspacePath, container: '/workspace' }],
      ports: [`${portRange.start}-${portRange.end}:${portRange.start}-${portRange.end}`],
      environment: {
        AGENT_ID: agent.id,
        AGENT_ROLE: agent.role,
      },
      restart: 'unless-stopped',
    });

    await dockerClient.startContainer(containerName);

    return {
      containerName,
      workspacePath,
      portRange,
      imageUsed: image,
    };
  }

  private isDevelopmentRole(role: string): boolean {
    return [
      'frontend-engineer',
      'backend-engineer',
      'api-engineer',
      'data-engineer',
      'devops-engineer',
    ].includes(role);
  }
}
```

#### Health Monitoring

```typescript
class ContainerHealthMonitor {
  async checkHealth(agentId: string): Promise<HealthStatus> {
    const containerName = `agent-${agentId}`;
    const status = await dockerClient.inspectContainer(containerName);

    return {
      running: status.State.Running,
      uptime: status.State.StartedAt,
      cpuUsage: status.Stats.cpu_stats.cpu_usage.total_usage,
      memoryUsage: status.Stats.memory_stats.usage,
      diskUsage: await this.checkDiskUsage(containerName),
    };
  }
}
```

#### Resource Limits

Prevent agents from consuming too many resources:

```yaml
services:
  agent-container:
    image: agent-runtime-node
    deploy:
      resources:
        limits:
          cpus: '2.0'       # Max 2 CPU cores
          memory: 4G        # Max 4GB RAM
        reservations:
          cpus: '0.5'       # Guaranteed 0.5 cores
          memory: 1G        # Guaranteed 1GB
```

### Tool Additions Summary

New tools needed for dev work:

| Tool Name | Purpose | Used By |
|-----------|---------|---------|
| `persistent_bash` | Run shell commands with persistent state | All dev roles |
| `browser_screenshot` | Capture UI screenshots | Frontend, UX Designer |
| `browser_evaluate` | Run JS in browser context | Frontend |
| `file_tree` | Show directory structure | All dev roles |
| `file_watch` | Monitor file changes | Frontend (hot reload) |
| `port_allocate` | Get available port for service | Backend, Frontend, API |
| `port_list` | Show allocated ports | All dev roles |
| `container_logs` | View container stdout/stderr | DevOps, Backend |
| `process_list` | Show running processes | All dev roles |
| `process_kill` | Stop a process | All dev roles |

### Updated Role Definitions

Development roles get additional tools:

```typescript
// Example: Frontend Engineer
{
  role: 'Frontend Engineer',
  defaultTools: [
    // Existing tools
    'web_search',
    'ask_colleague',
    'delegate_task',

    // NEW: Development tools
    'persistent_bash',
    'browser_screenshot',
    'browser_evaluate',
    'file_tree',
    'file_watch',
    'port_allocate',
    'port_list',
    'process_list',
    'process_kill',

    // File operations
    'file_read',
    'file_write',
  ],
  baseSystemPrompt: `You are a Frontend Engineer with expertise in React, TypeScript, and modern web development.

IMPORTANT: You have access to a persistent development environment. When you:
1. Run commands with persistent_bash, your shell state (cwd, env vars) persists
2. Start a dev server, use port_allocate first to get an available port
3. Make UI changes, ALWAYS take a screenshot with browser_screenshot to verify
4. See visual bugs, iterate until the UI looks correct

Example workflow:
- cd /workspace/projects/website
- npm install
- port_allocate → port 3000
- npm run dev -- --port 3000
- browser_screenshot → verify homepage renders
- (if needed) fix bugs and screenshot again

You can see what you're building. Use that feedback loop.`,
}
```

### Cost & Performance Implications

#### Resource Requirements

Per development agent:
- **CPU:** 0.5-2 cores (bursts during builds)
- **Memory:** 1-4 GB
- **Disk:** 5-10 GB (node_modules are large)
- **Network:** Minimal (outbound for npm, git)

For 10 simultaneous dev agents:
- **Server specs:** 16 core, 64 GB RAM, 200 GB SSD
- **Monthly cost:** ~$80-120/month (Hetzner dedicated server)

#### Scaling Strategy

- **Phase 1 (MVP):** Single server, max 10 dev agents
- **Phase 2:** Kubernetes cluster, auto-scaling based on load
- **Phase 3:** Multi-region for enterprise customers

### Security Considerations

1. **Isolation:** Each agent in separate container (network + filesystem isolation)
2. **Resource limits:** Prevent DoS from runaway processes
3. **No privileged mode:** Containers run as non-root
4. **Secrets management:** Inject via environment variables, never commit to agent workspace
5. **Audit logs:** All bash commands logged for review

### Migration Path for Non-Dev Agents

Agents that don't need containers (SEO, Marketing, Operations) continue using existing tool system with no changes. Container infrastructure is opt-in based on role.

```typescript
// Check if agent needs container
if (agent.role.includes('engineer') || agent.role.includes('designer')) {
  await containerProvisioner.provisionForAgent(agent);
} else {
  // Use host process for bash execution (existing behavior)
}
```

---

## Implementation Plan

### Week 1: Execution Environment + Template System

**Day 1-2: Container Infrastructure**
- [ ] Create Dockerfile for `agent-runtime-node` base image
- [ ] Include Node.js 22, pnpm, Git, Playwright, Chrome
- [ ] Test image builds and container starts
- [ ] Create `ContainerProvisioner` class
- [ ] Implement workspace directory creation
- [ ] Test container lifecycle (start, stop, health check)

**Day 3-4: Enhanced Development Tools**
- [ ] Build `PersistentBashTool` with stateful shell sessions
- [ ] Build `BrowserTool` with Playwright integration
- [ ] Implement `browser_screenshot` action
- [ ] Implement `browser_evaluate` action
- [ ] Build `FileSystemTools` (file_tree, file_watch)
- [ ] Build `PortManagementTool` with role-based port ranges
- [ ] Build `ProcessManagementTool` (list, kill)
- [ ] Add all new tools to tool registry

**Day 5-6: Database & Templates**
- [ ] Add Prisma models (RoleTemplate, Background, HiredAgent)
- [ ] Add `needsContainer` boolean to RoleTemplate
- [ ] Add `containerInfo` JSON field to Agent model
- [ ] Run migration
- [ ] Create template type definitions
- [ ] Build 5 role templates (SEO Engineer, Backend Engineer, Frontend Engineer, Project Manager, Operations Manager)
- [ ] Mark dev roles as needing containers

**Day 7: Background Library + Resume Generator**
- [ ] Create 3 backgrounds per role (15 total)
- [ ] Each background: personality traits, working style, prompt modifiers, expertise boosts
- [ ] Test system prompt generation with different backgrounds
- [ ] Build resume generator using Claude with few-shot examples
- [ ] Test generation for all role+background combos
- [ ] Verify resumes feel distinct and realistic

### Week 2: Dynamic Agent Loading + Hiring UI

**Day 1-2: Dynamic Agent Loader + Container Integration**
- [ ] Build `DynamicAgentLoader` class
- [ ] Read HiredAgent records from DB on framework boot
- [ ] Construct EmployeeDefinition dynamically per record
- [ ] Integrate ContainerProvisioner with agent creation flow
- [ ] Auto-provision containers for dev roles on hire
- [ ] Test: Hire Backend Engineer → container starts → persistent bash works
- [ ] Test: Frontend Engineer can take screenshots of localhost:3000

**Day 3-4: Next.js Setup + Hiring Flow**
- [ ] Initialize Next.js 14 (App Router)
- [ ] Setup Tailwind CSS + shadcn/ui components
- [ ] Create layout + navigation
- [ ] Connect to existing Prisma instance
- [ ] Role selection page with grid (filterable by category)
- [ ] Candidate comparison view (side-by-side resumes)
- [ ] API endpoint: `POST /api/resumes/generate` (generate 3 resumes for role)
- [ ] API endpoint: `POST /api/agents/hire` (create HiredAgent + Agent + container if needed)

**Day 5-6: Dashboard**
- [ ] Employee list view (cards with status, role, background)
- [ ] Team composition overview (Marketing vs Engineering vs Ops)
- [ ] Recent activity feed (from Slack messages + task completions)
- [ ] Link to Slack channels
- [ ] Container status indicator for dev roles (running, stopped, health)
- [ ] Port allocation display (show which ports agent is using)

**Day 7: Polish & Testing**
- [ ] Employee detail page (resume, tasks, performance metrics)
- [ ] Pause/unpause functionality
- [ ] Terminate employee (stop container, soft delete record)
- [ ] Error handling + loading states
- [ ] Integration test: Full hiring flow from UI → agent working in Slack
- [ ] Integration test: Frontend Engineer builds a component and screenshots it
- [ ] Deploy UI to Vercel, containers to Hetzner/AWS

### Week 3-4: Advanced Features (Optional)

**AI Interview Preview:**
- [ ] Generate sample Q&A for each candidate
- [ ] Show in expandable section on candidate card

**Custom Backgrounds:**
- [ ] UI for creating custom backgrounds
- [ ] Form validation
- [ ] Preview generated resume before saving

**Performance Analytics:**
- [ ] Task completion metrics
- [ ] Collaboration graph
- [ ] Cost tracking

### Week 5-6: Enterprise (If Needed)

**Multi-workspace:**
- [ ] Workspace model + UI
- [ ] Workspace switching
- [ ] Isolated data per workspace

**RBAC:**
- [ ] User model
- [ ] Authentication (Clerk or NextAuth)
- [ ] Permission checks

---

## MVP Scope (Target: 2 weeks)

### Must-Have
✅ Docker container infrastructure for dev agents
✅ Enhanced tools: persistent_bash, browser_screenshot, file operations, port management
✅ 5 role templates (SEO Engineer, Backend Engineer, Frontend Engineer, Project Manager, Operations Manager)
✅ 3 backgrounds per role (15 combinations total)
✅ AI resume generator (realistic names, experience, achievements)
✅ Hiring flow UI (role select → candidate review → hire)
✅ Dashboard showing hired employees (with container status for dev roles)
✅ Dynamic agent loading from DB (reads HiredAgent records on boot)
✅ Container provisioning on hire (automatic for dev roles)
✅ Integration with existing Slack agents

### Nice-to-Have (but defer)
⏸️ AI interview preview
⏸️ Custom backgrounds
⏸️ Performance analytics
⏸️ Team templates
⏸️ Agent training/feedback

### Explicitly Out of Scope for MVP
❌ Multi-workspace
❌ RBAC
❌ SSO
❌ Custom tool builder
❌ White-label

---

## Key Design Decisions

### 1. Resumes Are Cached
**Decision:** Generate resumes once during template seeding, store in DB.
**Why:** Faster hiring flow, consistent candidates, lower LLM costs.
**Trade-off:** Less variety. (Can add "regenerate" button later.)

### 2. All Agents Use BaseAgent
**Decision:** No custom agent classes for MVP.
**Why:** System prompts + backgrounds provide enough personality variance.
**Trade-off:** Can't customize behavior at code level. (Add later if needed.)

### 3. UI Lives in Same Repo
**Decision:** Next.js UI in `src/ui/` alongside framework code.
**Why:** Simpler deployment, shared types, monorepo simplicity.
**Trade-off:** Larger repo. (Can split later if needed.)

### 4. No Auth for MVP
**Decision:** Single-user mode, no login required.
**Why:** Faster MVP, fewer moving parts.
**Trade-off:** Not multi-tenant. (Add Clerk in Week 3 if needed.)

---

## Monetization Strategy

### Free Tier
- 3 employees
- 100 LLM calls/month
- Community support
- @agents/base branding

### Pro Tier ($49/month)
- 15 employees
- 5,000 LLM calls/month
- Custom backgrounds
- Priority support
- Remove branding

### Enterprise ($299/month)
- Unlimited employees
- Unlimited LLM calls
- Multi-workspace
- SSO
- White-label
- Dedicated support

---

## Go-to-Market

### Target Audience
1. **Solo founders** - Need help but can't afford full team
2. **Small agencies** - Want to scale without hiring
3. **Product teams** - Supplement existing team with AI
4. **Side projects** - 24/7 operations on a budget

### Launch Strategy
1. **Week 1-2:** Build MVP
2. **Week 3:** Private beta (10 users)
3. **Week 4:** Public beta (Product Hunt, HN)
4. **Week 5-6:** Iterate based on feedback
5. **Week 7:** Launch paid tiers

### Marketing Channels
- Product Hunt launch
- Hacker News Show HN
- Twitter/X demo videos
- LinkedIn posts with case studies
- Dev.to technical breakdown
- YouTube walkthrough

### Demo Video Script
```
"Imagine if you could hire AI employees that actually work together.

Not chatbots. Not glorified GPT wrappers. Actual employees with:
- Unique personalities
- Different working styles
- Real collaboration in Slack

Watch this: [Hiring flow demo]

I'm hiring an SEO Engineer. I see 3 candidates:
- Sarah, an energy sector veteran. Analytical. Data-driven.
- Jordan, from consumer tech. Creative. Fast-moving.
- Alex, agency experience. Versatile. Process-oriented.

I hire Sarah. She's deployed. Now watch her work: [Slack demo]

She's researching keywords, collaborating with the content team,
and delegating tasks to our social media manager.

All powered by @agents/base - the framework for building AI teams.

Start with 3 free employees. No code required.
[link]"
```

---

## Success Metrics

### Week 2 (MVP Launch)
- [ ] 10 beta users
- [ ] 50 total employees hired
- [ ] 1,000 agent-to-agent messages
- [ ] 0 critical bugs

### Week 4 (Public Beta)
- [ ] 100 users
- [ ] 500 total employees
- [ ] 10,000 LLM calls
- [ ] $0 MRR (free tier only)

### Week 8 (Paid Launch)
- [ ] 500 users
- [ ] 50 paying customers
- [ ] $2,500 MRR
- [ ] 3.0+ NPS score

---

## Technical Risks & Mitigations

### Risk 1: LLM Costs
**Problem:** Resume generation + agent runs = expensive
**Mitigation:**
- Cache generated resumes
- Use Haiku for resume generation
- Set per-user LLM call limits
- Offer "budget mode" with lower token limits

### Risk 2: Resume Quality
**Problem:** Generated resumes feel fake or repetitive
**Mitigation:**
- Hand-craft first batch for seeding
- Use few-shot examples with Claude
- A/B test prompts for variety
- Allow users to regenerate if unsatisfied

### Risk 3: Personality Not Distinct Enough
**Problem:** All agents sound the same despite different backgrounds
**Mitigation:**
- Test extensively with different prompt modifiers
- Add more personality traits to backgrounds
- Use temperature variations per background
- Collect user feedback on distinctiveness

### Risk 4: Slack Rate Limits
**Problem:** Many agents posting simultaneously
**Mitigation:**
- Implement message queue with rate limiting
- Stagger agent responses
- Use Slack's Socket Mode (no webhooks)
- Monitor rate limit headers

### Risk 5: Container Resource Exhaustion
**Problem:** Dev agents running builds/servers consume too much CPU/memory
**Mitigation:**
- Set hard resource limits per container (2 CPU cores, 4GB RAM max)
- Monitor container health and restart if unresponsive
- Implement auto-scaling or queue system during high load
- Alert admins when resource usage exceeds 80%

### Risk 6: Port Conflicts
**Problem:** Multiple agents trying to use same port
**Mitigation:**
- Pre-allocate port ranges per role (Frontend: 3000-3099, Backend: 4000-4099)
- PortManagementTool tracks allocations in database
- Validate port availability before starting services
- Agents must request ports explicitly (no assumptions)

### Risk 7: Container Startup Latency
**Problem:** Provisioning containers on hire takes 10-30 seconds
**Mitigation:**
- Pre-warm container pool (keep 2-3 idle containers ready)
- Use smaller base images (multi-stage builds)
- Cache npm/pnpm dependencies in image layers
- Show "Setting up workspace..." loading state in UI

---

## Open Questions

1. **Should backgrounds be role-specific or cross-role?**
   - Option A: Each role gets unique backgrounds (more work, more relevant)
   - Option B: Backgrounds apply across roles (less work, more generic)
   - **Recommendation:** Start with role-specific for top 5 roles, expand later

2. **How to handle agent updates?**
   - If we fix a bug in SEO Engineer template, do existing agents get the fix?
   - **Recommendation:** Template updates don't affect existing agents (immutable)

3. **What happens when an agent is terminated?**
   - Do we delete their data or just mark as inactive?
   - **Recommendation:** Soft delete (mark terminated), keep data for analytics

4. **Should users name their employees or use generated names?**
   - **Recommendation:** Default to generated name, allow customization

5. **Do we need approval flow for destructive agent actions?**
   - Even with HITL built in?
   - **Recommendation:** Yes, keep existing approval system

---

## Execution Environment Verification

Before proceeding with full implementation, verify the container infrastructure works:

### Phase 0: Proof of Concept (2-3 hours)

**Container PoC:**
- [ ] Build `agent-runtime-node` Docker image
- [ ] Start container with volume mount
- [ ] Execute `docker exec` command and verify state persists across multiple calls
- [ ] Test: `docker exec container-id bash -c "cd /workspace && pwd"` → then another exec → verify still in /workspace

**Playwright PoC:**
- [ ] Inside container, install Playwright
- [ ] Start simple HTTP server (python3 -m http.server 3000)
- [ ] Run Playwright script to take screenshot of localhost:3000
- [ ] Verify screenshot saved to volume mount (accessible from host)

**Port Isolation PoC:**
- [ ] Start two containers with different port ranges
- [ ] Container 1 starts server on port 3000
- [ ] Container 2 starts server on port 4000
- [ ] Verify both accessible from host (curl localhost:3000, curl localhost:4000)
- [ ] Verify containers cannot see each other's services (isolated networks)

**Expected results:**
- All PoC tests pass ✅
- Persistent bash confirmed working ✅
- Screenshot capture confirmed working ✅
- Port isolation confirmed working ✅

**If PoC fails:**
- Investigate Docker networking vs. direct host networking trade-offs
- Consider Docker-in-Docker for container builds (DevOps Engineer)
- Evaluate alternative: VM per agent (heavier but more isolated)

---

## Next Steps

1. **Run Execution Environment PoC** (see above) - Verify Docker approach works
2. **Review this plan** - Feedback/changes on architecture?
3. **Provision development server** - Hetzner/AWS with Docker installed
4. **Start Week 1, Day 1** - Build container infrastructure
5. **Iterate on base image** - Add tools as needed per role

**Timeline:**
- **Day 0:** PoC verification (2-3 hours)
- **Week 1:** Container infrastructure + templates
- **Week 2:** Dynamic loading + hiring UI
- **Week 3:** Polish + beta testing
- **Week 4:** Launch 🚀

**Ready to start building?** Let's ship this. 🚀
