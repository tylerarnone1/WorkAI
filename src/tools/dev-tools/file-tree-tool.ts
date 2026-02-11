import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';
import { getDockerClient } from '../../container/docker-client.js';
import { createChildLogger } from '../../core/logger/index.js';

const log = createChildLogger({ module: 'file-tree-tool' });

export class FileTreeTool implements ITool {
  definition: ToolDefinition = {
    name: 'file_tree',
    description:
      'Show directory structure as a tree. Useful for understanding project layout before making changes.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to show tree for (default: /workspace)',
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum depth to traverse (default: 3)',
        },
        showHidden: {
          type: 'boolean',
          description: 'Show hidden files (default: false)',
        },
      },
    },
    category: 'development',
  };

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const targetPath = (args['path'] as string) ?? '/workspace';
    const maxDepth = (args['maxDepth'] as number) ?? 3;
    const showHidden = (args['showHidden'] as boolean) ?? false;

    const containerName = `agent-${context.agentId}`;

    try {
      const docker = getDockerClient();
      const container = docker.getContainer(containerName);

      // Use tree command if available, otherwise use find with formatting
      const hiddenFlag = showHidden ? '-a' : '';
      const command = `
        if command -v tree &> /dev/null; then
          tree -L ${maxDepth} ${hiddenFlag} -F --dirsfirst "${targetPath}"
        else
          # Fallback to find + awk
          find "${targetPath}" -maxdepth ${maxDepth} ${showHidden ? '' : '-not -path "*/\\.*"'} | awk '
          BEGIN { FS="/" }
          {
            depth = NF - split("${targetPath}", a, "/")
            indent = ""
            for (i = 0; i < depth; i++) indent = indent "  "
            print indent "└─ " $NF
          }'
        fi
      `;

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

      log.info({ agentId: context.agentId, path: targetPath }, 'File tree displayed');

      return {
        success: true,
        output: output.trim() || 'Directory is empty',
      };
    } catch (err) {
      log.error({ err, agentId: context.agentId, path: targetPath }, 'Failed to show file tree');
      return {
        success: false,
        output: `Failed to show file tree: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }
}
