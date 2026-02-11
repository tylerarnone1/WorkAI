import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';
import { OrgRegistry } from '../../agent/org-registry.js';
import { getPrisma } from '../../core/database/index.js';

export class FindExpertTool implements ITool {
  definition: ToolDefinition = {
    name: 'find_expert',
    description: 'Find colleagues with specific expertise, skills, or in a particular role/team. Use this to discover who to ask for help or collaborate with.',
    parameters: {
      type: 'object',
      properties: {
        expertise: {
          type: 'array',
          description: 'Skills or expertise areas to search for (e.g., ["kubernetes", "api-design"])',
          items: { type: 'string' },
        },
        role: {
          type: 'string',
          description: 'Search for a specific role (e.g., "Backend engineer")',
        },
        team: {
          type: 'string',
          description: 'Search within a specific team (e.g., "Engineering", "Marketing")',
        },
        limit: {
          type: 'number',
          description: 'Max number of results (default: 5)',
        },
      },
    },
    category: 'collaboration',
  };

  async execute(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const prisma = getPrisma();
    const orgRegistry = new OrgRegistry(prisma);

    const expertise = args['expertise'] as string[] | undefined;
    const role = args['role'] as string | undefined;
    const team = args['team'] as string | undefined;
    const limit = (args['limit'] as number) ?? 5;

    try {
      let results;

      if (expertise && expertise.length > 0) {
        results = await orgRegistry.findByExpertise(expertise, limit);
      } else if (role) {
        results = await orgRegistry.findByRole(role);
      } else if (team) {
        results = await orgRegistry.findByTeam(team);
      } else {
        return {
          success: false,
          output: 'Please specify at least one search criteria: expertise, role, or team.',
        };
      }

      if (results.length === 0) {
        return {
          success: true,
          output: 'No matching colleagues found. Try different search terms or check the company directory.',
        };
      }

      const formatted = results.map(agent => ({
        name: agent.name,
        displayName: agent.displayName,
        role: agent.role,
        team: agent.team,
        expertise: agent.expertise,
        slackHandle: `@${agent.name}`,
        channels: agent.slackChannels,
      }));

      return {
        success: true,
        output: JSON.stringify(formatted, null, 2),
      };
    } catch (err) {
      return {
        success: false,
        output: `Error finding expert: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }
}
