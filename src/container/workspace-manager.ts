import * as fs from 'fs/promises';
import * as path from 'path';
import { createChildLogger } from '../core/logger/index.js';
import type { WorkspaceStructure } from './types.js';

const log = createChildLogger({ module: 'workspace-manager' });

export class WorkspaceManager {
  private baseWorkspacePath: string;

  constructor(baseWorkspacePath?: string) {
    this.baseWorkspacePath = baseWorkspacePath ?? path.join(process.cwd(), 'agent-workspaces');
  }

  /**
   * Get the workspace path for an agent
   */
  getWorkspacePath(agentName: string, agentId: string): string {
    return path.join(this.baseWorkspacePath, `${agentName}-${agentId}`);
  }

  /**
   * Create workspace directory structure for an agent
   */
  async createWorkspace(agentName: string, agentId: string): Promise<WorkspaceStructure> {
    const workspacePath = this.getWorkspacePath(agentName, agentId);

    try {
      // Create main workspace directory
      await fs.mkdir(workspacePath, { recursive: true });

      // Create subdirectories
      const projects = path.join(workspacePath, 'projects');
      const screenshots = path.join(workspacePath, 'screenshots');
      const logs = path.join(workspacePath, 'logs');
      const ports = path.join(workspacePath, 'ports.json');

      await Promise.all([
        fs.mkdir(projects, { recursive: true }),
        fs.mkdir(screenshots, { recursive: true }),
        fs.mkdir(logs, { recursive: true }),
      ]);

      // Create empty ports.json file
      await fs.writeFile(ports, JSON.stringify({ allocated: [] }, null, 2));

      // Create .bashrc with useful aliases
      const bashrc = path.join(workspacePath, '.bashrc');
      await fs.writeFile(
        bashrc,
        `# Agent workspace bashrc
export PS1="\\u@agent:\\w$ "
alias ll='ls -alh'
alias ..='cd ..'
`,
      );

      log.info({ agentName, agentId, workspacePath }, 'Workspace created');

      return { projects, screenshots, logs, ports };
    } catch (err) {
      log.error({ err, agentName, agentId }, 'Failed to create workspace');
      throw new Error(`Failed to create workspace for ${agentName}: ${err}`);
    }
  }

  /**
   * Clean up workspace directory
   */
  async deleteWorkspace(agentName: string, agentId: string): Promise<void> {
    const workspacePath = this.getWorkspacePath(agentName, agentId);

    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
      log.info({ agentName, agentId, workspacePath }, 'Workspace deleted');
    } catch (err) {
      log.error({ err, agentName, agentId }, 'Failed to delete workspace');
      throw new Error(`Failed to delete workspace for ${agentName}: ${err}`);
    }
  }

  /**
   * Check if workspace exists
   */
  async workspaceExists(agentName: string, agentId: string): Promise<boolean> {
    const workspacePath = this.getWorkspacePath(agentName, agentId);
    try {
      await fs.access(workspacePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get workspace disk usage
   */
  async getWorkspaceSize(agentName: string, agentId: string): Promise<number> {
    const workspacePath = this.getWorkspacePath(agentName, agentId);

    const getDirectorySize = async (dirPath: string): Promise<number> => {
      let size = 0;
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            size += await getDirectorySize(entryPath);
          } else {
            const stats = await fs.stat(entryPath);
            size += stats.size;
          }
        }
      } catch (err) {
        log.warn({ err, dirPath }, 'Failed to get directory size');
      }
      return size;
    };

    return getDirectorySize(workspacePath);
  }
}
