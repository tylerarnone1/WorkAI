export interface ContainerInfo {
  containerName: string;
  containerId: string;
  workspacePath: string;
  portRange: PortRange;
  imageUsed: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
}

export interface PortRange {
  start: number;
  end: number;
}

export interface ContainerHealthStatus {
  running: boolean;
  uptime?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  memoryLimit?: number;
  diskUsage?: number;
  restartCount?: number;
}

export interface ContainerProvisionOptions {
  agentId: string;
  agentName: string;
  role: string;
  image?: string;
  cpuLimit?: number;
  memoryLimit?: string;
}

export interface WorkspaceStructure {
  projects: string;
  screenshots: string;
  logs: string;
  ports: string;
}

export const ROLE_PORT_RANGES: Record<string, PortRange> = {
  'frontend-engineer': { start: 3000, end: 3099 },
  'backend-engineer': { start: 4000, end: 4099 },
  'api-engineer': { start: 5000, end: 5099 },
  'data-engineer': { start: 8000, end: 8099 },
  'devops-engineer': { start: 9000, end: 9099 },
  'ux-designer': { start: 6000, end: 6099 },
};

export const DEFAULT_PORT_RANGE: PortRange = { start: 7000, end: 7099 };

export const DEVELOPMENT_ROLES = [
  'frontend-engineer',
  'backend-engineer',
  'api-engineer',
  'data-engineer',
  'devops-engineer',
  'ux-designer',
] as const;

export type DevelopmentRole = (typeof DEVELOPMENT_ROLES)[number];

export function isDevelopmentRole(role: string): boolean {
  const normalized = role.toLowerCase().replace(/\s+/g, '-');
  return DEVELOPMENT_ROLES.includes(normalized as DevelopmentRole);
}

export function getPortRangeForRole(role: string): PortRange {
  const normalized = role.toLowerCase().replace(/\s+/g, '-');
  return ROLE_PORT_RANGES[normalized] ?? DEFAULT_PORT_RANGE;
}

export function getImageForRole(role: string): string {
  const normalized = role.toLowerCase().replace(/\s+/g, '-');

  // For now, all roles use the same base image
  // In the future, we can have specialized images
  if (normalized.includes('data')) {
    return 'agent-runtime-python:latest';
  }

  return 'agent-runtime-node:latest';
}
