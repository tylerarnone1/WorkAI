import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';
import { getDockerClient } from '../../container/docker-client.js';
import { createChildLogger } from '../../core/logger/index.js';

const log = createChildLogger({ module: 'process-management-tool' });

export class ProcessManagementTool implements ITool {
  definition: ToolDefinition = {
    name: 'process_manage',
    description:
      'List or kill processes in your container. Useful for stopping dev servers or cleaning up hung processes.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'kill'],
          description: 'Action to perform',
        },
        pid: {
          type: 'number',
          description: 'Process ID to kill (required for kill action)',
        },
        signal: {
          type: 'string',
          description: 'Signal to send (default: TERM). Options: TERM, KILL, INT',
        },
      },
      required: ['action'],
    },
    category: 'development',
  };

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const action = args['action'] as 'list' | 'kill';
    const pid = args['pid'] as number | undefined;
    const signal = (args['signal'] as string) ?? 'TERM';

    const containerName = `agent-${context.agentId}`;

    try {
      const docker = getDockerClient();
      const container = docker.getContainer(containerName);

      switch (action) {
        case 'list':
          return await this.listProcesses(container, context);

        case 'kill':
          if (!pid) {
            return { success: false, output: 'PID required for kill action' };
          }
          return await this.killProcess(container, context, pid, signal);

        default:
          return { success: false, output: `Unknown action: ${action}` };
      }
    } catch (err) {
      log.error({ err, agentId: context.agentId, action }, 'Process management failed');
      return {
        success: false,
        output: `Process management failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  private async listProcesses(container: any, context: ToolExecutionContext): Promise<ToolResult> {
    const command = `ps aux --sort=-%mem | head -20`;

    const exec = await container.exec({
      Cmd: ['bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({});
    let output = '';

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        output += chunk.slice(8).toString();
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    log.info({ agentId: context.agentId }, 'Listed processes');

    return {
      success: true,
      output: `Top processes by memory:\n\n${output}`,
    };
  }

  private async killProcess(
    container: any,
    context: ToolExecutionContext,
    pid: number,
    signal: string,
  ): Promise<ToolResult> {
    const command = `kill -${signal} ${pid} && echo "Process ${pid} killed" || echo "Failed to kill process ${pid}"`;

    const exec = await container.exec({
      Cmd: ['bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({});
    let output = '';

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        output += chunk.slice(8).toString();
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    log.info({ agentId: context.agentId, pid, signal }, 'Killed process');

    return {
      success: true,
      output: output.trim(),
    };
  }
}
