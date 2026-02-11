import type Docker from 'dockerode';
import { createChildLogger } from '../core/logger/index.js';
import { getDockerClient, checkDockerAvailable, ensureImageExists } from './docker-client.js';
import { WorkspaceManager } from './workspace-manager.js';
import type {
  ContainerInfo,
  ContainerProvisionOptions,
  ContainerHealthStatus,
  PortRange,
} from './types.js';
import { isDevelopmentRole, getPortRangeForRole, getImageForRole } from './types.js';

const log = createChildLogger({ module: 'container-provisioner' });

export class ContainerProvisioner {
  private docker: Docker;
  private workspaceManager: WorkspaceManager;
  private containers: Map<string, ContainerInfo> = new Map();

  constructor(baseWorkspacePath?: string) {
    this.docker = getDockerClient();
    this.workspaceManager = new WorkspaceManager(baseWorkspacePath);
  }

  /**
   * Check if an agent needs a container
   */
  needsContainer(role: string): boolean {
    return isDevelopmentRole(role);
  }

  /**
   * Provision a container for an agent
   */
  async provisionForAgent(options: ContainerProvisionOptions): Promise<ContainerInfo | null> {
    const { agentId, agentName, role, image, cpuLimit, memoryLimit } = options;

    // Check if agent needs a container
    if (!this.needsContainer(role)) {
      log.info({ agentId, agentName, role }, 'Agent does not need a container');
      return null;
    }

    // Check if Docker is available
    const dockerAvailable = await checkDockerAvailable();
    if (!dockerAvailable) {
      throw new Error('Docker daemon is not available. Cannot provision container.');
    }

    try {
      // Determine image and port range
      const imageName = image ?? getImageForRole(role);
      const portRange = getPortRangeForRole(role);

      // Check if image exists
      const imageExists = await ensureImageExists(imageName);
      if (!imageExists) {
        throw new Error(
          `Docker image ${imageName} not found. Please build it first using: docker build -f docker/agent-runtime-node.Dockerfile -t ${imageName} .`,
        );
      }

      // Create workspace
      log.info({ agentId, agentName }, 'Creating workspace...');
      await this.workspaceManager.createWorkspace(agentName, agentId);
      const workspacePath = this.workspaceManager.getWorkspacePath(agentName, agentId);

      // Create container
      const containerName = `agent-${agentId}`;
      log.info({ agentId, containerName, imageName }, 'Creating container...');

      const container = await this.docker.createContainer({
        name: containerName,
        Image: imageName,
        Hostname: containerName,
        Env: [`AGENT_ID=${agentId}`, `AGENT_ROLE=${role}`, `AGENT_NAME=${agentName}`],
        HostConfig: {
          Binds: [`${workspacePath}:/workspace`],
          PortBindings: this.createPortBindings(portRange),
          RestartPolicy: {
            Name: 'unless-stopped',
          },
          // Resource limits
          Memory: this.parseMemoryLimit(memoryLimit ?? '4g'),
          NanoCpus: (cpuLimit ?? 2) * 1e9, // Convert cores to nanocores
        },
        ExposedPorts: this.createExposedPorts(portRange),
      });

      // Start container
      log.info({ containerName }, 'Starting container...');
      await container.start();

      const containerInfo: ContainerInfo = {
        containerName,
        containerId: container.id,
        workspacePath,
        portRange,
        imageUsed: imageName,
        status: 'running',
      };

      this.containers.set(agentId, containerInfo);

      log.info({ agentId, containerName, containerId: container.id }, 'Container provisioned successfully');

      return containerInfo;
    } catch (err) {
      log.error({ err, agentId, agentName, role }, 'Failed to provision container');
      throw new Error(`Failed to provision container for ${agentName}: ${err}`);
    }
  }

  /**
   * Stop and remove a container
   */
  async deprovisionContainer(agentId: string): Promise<void> {
    const containerInfo = this.containers.get(agentId);
    if (!containerInfo) {
      log.warn({ agentId }, 'No container found for agent');
      return;
    }

    try {
      const container = this.docker.getContainer(containerInfo.containerId);

      // Stop container
      log.info({ agentId, containerName: containerInfo.containerName }, 'Stopping container...');
      await container.stop({ t: 10 }); // 10 second timeout

      // Remove container
      log.info({ agentId, containerName: containerInfo.containerName }, 'Removing container...');
      await container.remove();

      this.containers.delete(agentId);

      log.info({ agentId }, 'Container deprovisioned successfully');
    } catch (err) {
      log.error({ err, agentId }, 'Failed to deprovision container');
      throw new Error(`Failed to deprovision container: ${err}`);
    }
  }

  /**
   * Get container health status
   */
  async getContainerHealth(agentId: string): Promise<ContainerHealthStatus | null> {
    const containerInfo = this.containers.get(agentId);
    if (!containerInfo) {
      return null;
    }

    try {
      const container = this.docker.getContainer(containerInfo.containerId);
      const inspect = await container.inspect();
      const stats = await container.stats({ stream: false });

      return {
        running: inspect.State.Running,
        uptime: inspect.State.StartedAt,
        cpuUsage: this.calculateCpuPercent(stats),
        memoryUsage: stats.memory_stats?.usage ?? 0,
        memoryLimit: stats.memory_stats?.limit ?? 0,
        restartCount: inspect.RestartCount,
      };
    } catch (err) {
      log.error({ err, agentId }, 'Failed to get container health');
      return null;
    }
  }

  /**
   * Get container info for an agent
   */
  getContainerInfo(agentId: string): ContainerInfo | null {
    return this.containers.get(agentId) ?? null;
  }

  /**
   * List all managed containers
   */
  getAllContainers(): ContainerInfo[] {
    return Array.from(this.containers.values());
  }

  /**
   * Clean up workspace for an agent
   */
  async cleanupWorkspace(agentName: string, agentId: string): Promise<void> {
    await this.workspaceManager.deleteWorkspace(agentName, agentId);
  }

  // Helper methods

  private createPortBindings(portRange: PortRange): Docker.PortMap {
    const bindings: Docker.PortMap = {};
    for (let port = portRange.start; port <= portRange.end; port++) {
      bindings[`${port}/tcp`] = [{ HostPort: `${port}` }];
    }
    return bindings;
  }

  private createExposedPorts(portRange: PortRange): { [port: string]: {} } {
    const exposed: { [port: string]: {} } = {};
    for (let port = portRange.start; port <= portRange.end; port++) {
      exposed[`${port}/tcp`] = {};
    }
    return exposed;
  }

  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)([kmg]?)$/i);
    if (!match) {
      return 4 * 1024 * 1024 * 1024; // Default 4GB
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'k':
        return value * 1024;
      case 'm':
        return value * 1024 * 1024;
      case 'g':
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  private calculateCpuPercent(stats: any): number {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuCount = stats.cpu_stats.online_cpus || 1;

    if (systemDelta > 0 && cpuDelta > 0) {
      return (cpuDelta / systemDelta) * cpuCount * 100;
    }
    return 0;
  }
}
