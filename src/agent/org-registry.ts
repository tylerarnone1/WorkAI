import type { PrismaClient } from '@prisma/client';

export interface OrgAgent {
  name: string;
  displayName: string;
  role?: string;
  team?: string;
  reportsTo?: string;
  expertise: string[];
  slackChannels: string[];
}

export class OrgRegistry {
  constructor(private prisma: PrismaClient) {}

  private mapToOrgAgent(agent: {
    name: string;
    displayName: string;
    role: string | null;
    team: string | null;
    reportsTo: string | null;
    expertise: string[];
    slackChannels: string[];
  }): OrgAgent {
    return {
      name: agent.name,
      displayName: agent.displayName,
      role: agent.role ?? undefined,
      team: agent.team ?? undefined,
      reportsTo: agent.reportsTo ?? undefined,
      expertise: agent.expertise,
      slackChannels: agent.slackChannels,
    };
  }

  /**
   * Find agents by expertise tags.
   * Returns agents ranked by number of matching tags.
   */
  async findByExpertise(tags: string[], limit = 5): Promise<OrgAgent[]> {
    const agents = await this.prisma.agent.findMany({
      where: { enabled: true },
      select: {
        name: true,
        displayName: true,
        role: true,
        team: true,
        reportsTo: true,
        expertise: true,
        slackChannels: true,
      },
    });

    const lowerTags = tags.map(t => t.toLowerCase());
    const scored = agents
      .map(agent => {
        const matches = agent.expertise.filter((exp: string) =>
          lowerTags.some(tag => exp.toLowerCase().includes(tag)),
        ).length;
        return { agent, matches };
      })
      .filter(item => item.matches > 0)
      .sort((a, b) => b.matches - a.matches)
      .slice(0, limit);

    return scored.map(item => this.mapToOrgAgent(item.agent));
  }

  /**
   * Find agents by role (exact match).
   */
  async findByRole(role: string): Promise<OrgAgent[]> {
    const agents = await this.prisma.agent.findMany({
      where: {
        role: { equals: role, mode: 'insensitive' },
        enabled: true,
      },
      select: {
        name: true,
        displayName: true,
        role: true,
        team: true,
        reportsTo: true,
        expertise: true,
        slackChannels: true,
      },
    });
    return agents.map(a => this.mapToOrgAgent(a));
  }

  /**
   * Find agents by team.
   */
  async findByTeam(team: string): Promise<OrgAgent[]> {
    const agents = await this.prisma.agent.findMany({
      where: {
        team: { equals: team, mode: 'insensitive' },
        enabled: true,
      },
      select: {
        name: true,
        displayName: true,
        role: true,
        team: true,
        reportsTo: true,
        expertise: true,
        slackChannels: true,
      },
    });
    return agents.map(a => this.mapToOrgAgent(a));
  }

  /**
   * Get an agent's direct reports (agents that report to this agent).
   */
  async getDirectReports(agentName: string): Promise<OrgAgent[]> {
    const agents = await this.prisma.agent.findMany({
      where: {
        reportsTo: { equals: agentName, mode: 'insensitive' },
        enabled: true,
      },
      select: {
        name: true,
        displayName: true,
        role: true,
        team: true,
        reportsTo: true,
        expertise: true,
        slackChannels: true,
      },
    });
    return agents.map(a => this.mapToOrgAgent(a));
  }

  /**
   * Get an agent's manager (the agent they report to).
   */
  async getManager(agentName: string): Promise<OrgAgent | null> {
    const agent = await this.prisma.agent.findUnique({
      where: { name: agentName },
      select: { reportsTo: true },
    });

    if (!agent?.reportsTo) return null;

    const manager = await this.prisma.agent.findUnique({
      where: { name: agent.reportsTo },
      select: {
        name: true,
        displayName: true,
        role: true,
        team: true,
        reportsTo: true,
        expertise: true,
        slackChannels: true,
      },
    });

    return manager ? this.mapToOrgAgent(manager) : null;
  }

  /**
   * Get an agent's teammates (same team, excluding self).
   */
  async getTeammates(agentName: string): Promise<OrgAgent[]> {
    const agent = await this.prisma.agent.findUnique({
      where: { name: agentName },
      select: { team: true },
    });

    if (!agent?.team) return [];

    const agents = await this.prisma.agent.findMany({
      where: {
        team: agent.team,
        name: { not: agentName },
        enabled: true,
      },
      select: {
        name: true,
        displayName: true,
        role: true,
        team: true,
        reportsTo: true,
        expertise: true,
        slackChannels: true,
      },
    });

    return agents.map(a => this.mapToOrgAgent(a));
  }

  /**
   * Get full org context for an agent (their team, manager, direct reports).
   */
  async getOrgContext(agentName: string): Promise<{
    self: OrgAgent | null;
    manager: OrgAgent | null;
    teammates: OrgAgent[];
    directReports: OrgAgent[];
  }> {
    const self = await this.prisma.agent.findUnique({
      where: { name: agentName },
      select: {
        name: true,
        displayName: true,
        role: true,
        team: true,
        reportsTo: true,
        expertise: true,
        slackChannels: true,
      },
    });

    if (!self) {
      return { self: null, manager: null, teammates: [], directReports: [] };
    }

    const [manager, teammates, directReports] = await Promise.all([
      this.getManager(agentName),
      this.getTeammates(agentName),
      this.getDirectReports(agentName),
    ]);

    return { self: this.mapToOrgAgent(self), manager, teammates, directReports };
  }

  /**
   * Get all agents (for directory lookups).
   */
  async getAllAgents(): Promise<OrgAgent[]> {
    const agents = await this.prisma.agent.findMany({
      where: { enabled: true },
      select: {
        name: true,
        displayName: true,
        role: true,
        team: true,
        reportsTo: true,
        expertise: true,
        slackChannels: true,
      },
      orderBy: [{ team: 'asc' }, { name: 'asc' }],
    });
    return agents.map(a => this.mapToOrgAgent(a));
  }
}
