import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';
import { getPrisma } from '../../core/database/index.js';
import { createChildLogger } from '../../core/logger/index.js';
import { getPortRangeForRole } from '../../container/types.js';

const log = createChildLogger({ module: 'port-management-tool' });

interface PortAllocation {
  port: number;
  service: string;
  allocatedAt: Date;
}

export class PortManagementTool implements ITool {
  definition: ToolDefinition = {
    name: 'port_allocate',
    description:
      'Allocate an available port for your service (dev server, API, etc.). Each role has a dedicated port range. Always allocate a port before starting a server.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['allocate', 'release', 'list'],
          description: 'Action to perform',
        },
        service: {
          type: 'string',
          description: 'Name of the service (e.g., "vite-dev-server", "api-server")',
        },
        port: {
          type: 'number',
          description: 'Port number (required for release action)',
        },
      },
      required: ['action'],
    },
    category: 'development',
  };

  private allocations: Map<string, PortAllocation[]> = new Map();

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const action = args['action'] as 'allocate' | 'release' | 'list';
    const service = args['service'] as string | undefined;
    const port = args['port'] as number | undefined;

    try {
      switch (action) {
        case 'allocate':
          return await this.allocatePort(context, service ?? 'unknown');

        case 'release':
          if (!port) {
            return { success: false, output: 'Port number required for release action' };
          }
          return await this.releasePort(context, port);

        case 'list':
          return await this.listPorts(context);

        default:
          return { success: false, output: `Unknown action: ${action}` };
      }
    } catch (err) {
      log.error({ err, agentId: context.agentId, action }, 'Port management failed');
      return {
        success: false,
        output: `Port management failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  private async allocatePort(
    context: ToolExecutionContext,
    service: string,
  ): Promise<ToolResult> {
    const prisma = getPrisma();

    // Get agent's role to determine port range
    const agent = await prisma.agent.findUnique({
      where: { name: context.agentId },
      select: { role: true },
    });

    if (!agent || !agent.role) {
      return {
        success: false,
        output: 'Could not determine agent role for port allocation',
      };
    }

    const portRange = getPortRangeForRole(agent.role);
    const allocated = this.allocations.get(context.agentId) ?? [];

    // Find available port
    let availablePort: number | null = null;
    for (let p = portRange.start; p <= portRange.end; p++) {
      if (!allocated.some(a => a.port === p)) {
        availablePort = p;
        break;
      }
    }

    if (!availablePort) {
      return {
        success: false,
        output: `No available ports in range ${portRange.start}-${portRange.end}. Release some ports first.`,
      };
    }

    // Allocate port
    allocated.push({
      port: availablePort,
      service,
      allocatedAt: new Date(),
    });
    this.allocations.set(context.agentId, allocated);

    log.info(
      { agentId: context.agentId, port: availablePort, service },
      'Port allocated',
    );

    return {
      success: true,
      output: `Port ${availablePort} allocated for ${service}.\n\nUse: http://localhost:${availablePort}\n\nExample: npm run dev -- --port ${availablePort}`,
    };
  }

  private async releasePort(context: ToolExecutionContext, port: number): Promise<ToolResult> {
    const allocated = this.allocations.get(context.agentId) ?? [];
    const index = allocated.findIndex(a => a.port === port);

    if (index === -1) {
      return {
        success: false,
        output: `Port ${port} is not allocated`,
      };
    }

    const released = allocated.splice(index, 1)[0];
    this.allocations.set(context.agentId, allocated);

    log.info({ agentId: context.agentId, port }, 'Port released');

    return {
      success: true,
      output: `Port ${port} (${released.service}) released`,
    };
  }

  private async listPorts(context: ToolExecutionContext): Promise<ToolResult> {
    const allocated = this.allocations.get(context.agentId) ?? [];

    if (allocated.length === 0) {
      return {
        success: true,
        output: 'No ports currently allocated. Use action="allocate" to get a port.',
      };
    }

    const output = allocated
      .map(a => `- Port ${a.port}: ${a.service} (allocated ${a.allocatedAt.toLocaleString()})`)
      .join('\n');

    return {
      success: true,
      output: `Allocated ports:\n${output}`,
    };
  }
}
