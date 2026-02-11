import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';
import { getDockerClient } from '../../container/docker-client.js';
import { createChildLogger } from '../../core/logger/index.js';

const log = createChildLogger({ module: 'persistent-bash-tool' });

export class PersistentBashTool implements ITool {
  // Note: For true persistent bash sessions, we would maintain state
  // For MVP, each command runs independently in the persistent container

  definition: ToolDefinition = {
    name: 'persistent_bash',
    description:
      'Execute bash commands in your persistent development container. Working directory and environment variables persist across commands. Use this for cd, npm install, running servers, etc.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The bash command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 120000ms / 2 minutes)',
        },
      },
      required: ['command'],
    },
    category: 'development',
  };

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const command = args['command'] as string;
    const timeout = (args['timeout'] as number) ?? 120000;

    const { containerId, containerName } = this.getContainerInfo(context);

    if (!containerId) {
      return {
        success: false,
        output: 'No development container found for this agent. Only engineering roles have containers.',
      };
    }

    try {
      const docker = getDockerClient();
      const container = docker.getContainer(containerId);

      // Create exec instance
      const exec = await container.exec({
        Cmd: ['bash', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/workspace',
      });

      // Start exec and capture output
      const stream = await exec.start({});

      let stdout = '';
      let stderr = '';

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        stream.destroy();
      }, timeout);

      // Collect output
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          // Docker multiplexes stdout/stderr in the stream
          // First byte indicates stream type: 1=stdout, 2=stderr
          const streamType = chunk[0];
          const data = chunk.slice(8).toString(); // Skip 8-byte header

          if (streamType === 1) {
            stdout += data;
          } else if (streamType === 2) {
            stderr += data;
          }
        });

        stream.on('end', () => {
          clearTimeout(timeoutHandle);
          resolve();
        });

        stream.on('error', (err: Error) => {
          clearTimeout(timeoutHandle);
          reject(err);
        });
      });

      // Get exit code
      const inspectResult = await exec.inspect();
      const exitCode = inspectResult.ExitCode ?? 0;

      const output = [
        `Exit code: ${exitCode}`,
        stdout ? `\nStdout:\n${stdout}` : '',
        stderr ? `\nStderr:\n${stderr}` : '',
      ]
        .filter(Boolean)
        .join('');

      log.info(
        { agentId: context.agentId, containerName, command, exitCode },
        'Executed bash command',
      );

      return {
        success: exitCode === 0,
        output,
      };
    } catch (err) {
      log.error({ err, agentId: context.agentId, command }, 'Failed to execute bash command');
      return {
        success: false,
        output: `Failed to execute command: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  private getContainerInfo(context: ToolExecutionContext): {
    containerId: string | null;
    containerName: string | null;
  } {
    // Container info should be stored in context by the agent runner
    // For now, we'll use a simple naming convention
    const containerName = `agent-${context.agentId}`;

    // In a real implementation, we'd look up the container ID from our provisioner
    // For now, we'll just use the name and let Docker resolve it
    return {
      containerId: containerName,
      containerName,
    };
  }
}
