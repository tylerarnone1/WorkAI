# AI Employee Platform - UI

A dark minimalist Next.js application for hiring AI employees with unique backgrounds and personalities.

## Tech Stack

- **Next.js 15** with App Router
- **React 19**
- **TypeScript**
- **Tailwind CSS** - Custom dark theme
- **Framer Motion** - Smooth animations

## Getting Started

```bash
npm install
npm run dev
```

The application will be available at `http://localhost:3001`

## Environment

Single deployment mode (recommended):
- Use one shared env source (deployment env vars or root `.env`).
- Do not rely on `src/ui/.env.local`.
- Required server-side vars:
  - `DATABASE_URL`
  - one of `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`

Optional model/base URL vars:
- `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`
- `OPENAI_MODEL`, `OPENAI_BASE_URL`

## User Flow

### 1. Landing Page (`/`)
- Fade-in hero section with gradient text
- Features grid showcasing platform capabilities
- CTA button to start hiring

### 2. Role Selection (`/hire`)
- Grid of 5 available roles:
  - SEO Engineer
  - Backend Engineer
  - Frontend Engineer
  - Project Manager
  - Operations Manager
- Each role card shows icon, description, and color theme
- Hover animations for better UX

### 3. Candidate Review (`/hire/[slug]`)
- Displays 3 AI-generated candidates per role
- Each candidate has a unique background:
  - Different industry experience
  - Unique personality traits
  - Distinct working style
- Expandable resume cards showing:
  - Work experience with highlights
  - Skills and expertise
  - Personality and working style
- "Hire This Candidate" button

### 4. Paywall (`/checkout`)
- Triggered after first free hire
- Three pricing tiers:
  - **Starter**: $99/month - Up to 3 employees
  - **Professional**: $299/month - Up to 10 employees (highlighted)
  - **Enterprise**: Custom pricing
- FAQ section
- 14-day free trial for all plans

### 5. Dashboard (`/dashboard`)
- Minimal overview of hired employees
- Real-time status indicators:
  - 🟢 Active
  - 🟡 Idle
  - 🔴 Stopped
- Current task display for each agent
- Token usage metrics (today + total)
- Container info for development agents (port ranges)
- "Hire Another" CTA button

## API Routes

All API routes are currently using mock data. Backend integration pending.

### `GET /api/resumes/generate?role={slug}`
Generates 3 AI resume candidates for the specified role.

**Response:**
```json
{
  "resumes": [
    {
      "id": "bg-1",
      "name": "Alex Chen",
      "backgroundName": "Energy Sector Veteran",
      "backgroundDescription": "15 years optimizing...",
      "summary": "SEO specialist with...",
      "experience": [...],
      "skills": [...],
      "personality": [...],
      "workingStyle": "..."
    }
  ]
}
```

### `POST /api/agents/hire`
Hires an AI employee (creates Agent + HiredAgent + provisions container if needed).

**Request:**
```json
{
  "templateId": "seo-engineer",
  "backgroundId": "bg-1",
  "generatedName": "Alex Chen",
  "generatedResume": { ... }
}
```

**Response:**
```json
{
  "agent": {
    "id": "agent-123",
    "name": "Alex Chen",
    "role": "SEO Engineer",
    "status": "active",
    "hiredAt": "2024-01-15T10:30:00Z"
  }
}
```

### `GET /api/agents`
Lists all hired agents with current status and metrics.

**Response:**
```json
{
  "agents": [
    {
      "id": "1",
      "name": "Alex Chen",
      "role": "SEO Engineer",
      "status": "active",
      "currentTask": "Analyzing keywords...",
      "tokenUsage": { "today": 12500, "total": 45000 },
      "containerInfo": null
    }
  ]
}
```

### `GET /api/agents/[id]`
Gets detailed information about a specific agent.

## Design System

### Colors
- **Background**: `#0a0a0a` - Deep black
- **Foreground**: `#ededed` - Off-white
- **Card**: `#141414` - Dark gray
- **Border**: `#2a2a2a` - Subtle border
- **Primary**: `#6366f1` - Indigo
- **Secondary**: `#8b5cf6` - Purple
- **Accent**: `#ec4899` - Pink

### Animations
- **Fade In**: 0.6-0.8s ease-out
- **Stagger Children**: 0.1-0.2s delay
- **Hover Scale**: 1.05x transform
- **Card Glow**: Primary color shadow on hover

### Typography
- **Headings**: Bold tracking-tight
- **Body**: Inter font family
- **Muted Text**: `#8a8a8a`

## Next Steps for Backend Integration

1. **Connect Prisma to API routes**
   - Import `PrismaClient` in API routes
   - Replace mock data with actual database queries

2. **Wire up DynamicAgentLoader**
   - Import from `@/hiring/dynamic-agent-loader`
   - Call `hireAgent()` in `/api/agents/hire` endpoint
   - Call `loadAllHiredAgents()` in `/api/agents` endpoint

3. **Integrate Resume Generator**
   - Import from `@/templates/resume-generator`
   - Call `generateResume()` in `/api/resumes/generate` endpoint

4. **Add Authentication**
   - Implement user sessions
   - Track which agents belong to which user
   - Protect API routes with auth middleware

5. **Add Payment Processing**
   - Stripe integration in `/checkout` page
   - Subscription management
   - Usage-based billing for tokens

## File Structure

```
src/ui/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Global styles + animations
│   ├── hire/
│   │   ├── page.tsx                # Role selection
│   │   └── [slug]/
│   │       └── page.tsx            # Candidate review
│   ├── dashboard/
│   │   └── page.tsx                # Dashboard
│   ├── checkout/
│   │   └── page.tsx                # Pricing/paywall
│   └── api/
│       ├── resumes/
│       │   └── generate/
│       │       └── route.ts        # Generate resumes API
│       └── agents/
│           ├── route.ts            # List agents API
│           ├── hire/
│           │   └── route.ts        # Hire agent API
│           └── [id]/
│               └── route.ts        # Get agent details API
├── components/
│   └── ResumeCard.tsx              # Reusable resume card
├── tailwind.config.ts              # Tailwind theme
├── tsconfig.json                   # TypeScript config
└── package.json                    # Dependencies
```

## Features Implemented

✅ Dark minimalist design with custom color palette
✅ Fade-in animations on all pages
✅ Animated hiring sequence (Role → Candidates → Hire)
✅ First hire free, then paywall
✅ Minimal dashboard with agent status tracking
✅ Expandable resume cards
✅ Responsive design (mobile-friendly)
✅ Mock API routes ready for backend integration
✅ Staggered animations for lists
✅ Hover effects and transitions

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type check
npm run type-check
```
