import { BaseIntegration } from '../base-integration.js';
import type { CredentialStore } from '../credential-store.js';
import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../../tools/types.js';

/**
 * ArgoCD integration. Requires `baseUrl` in the integration credential metadata
 * (e.g., "https://argocd.yourorg.com"). Uses API token authentication (api_key credential type).
 */
export class ArgoCDIntegration extends BaseIntegration {
  readonly provider = 'argocd' as const;
  readonly credentialType = 'api_key' as const;
  private baseUrl = '';

  constructor(credentialStore: CredentialStore) {
    super(credentialStore);
  }

  getTools(): ITool[] {
    return [
      new ArgoListAppsTool(this),
      new ArgoGetAppTool(this),
      new ArgoSyncAppTool(this),
      new ArgoGetAppHealthTool(this),
      new ArgoRollbackTool(this),
    ];
  }

  async request(path: string, options: { method?: string; body?: unknown; agentId?: string } = {}) {
    if (!this.baseUrl) {
      const cred = await this.credentialStore.getCredential(this.provider, options.agentId);
      const meta = cred?.metadata as Record<string, unknown> | undefined;
      this.baseUrl = (meta?.['baseUrl'] as string) ?? '';
      if (!this.baseUrl) throw new Error('ArgoCD baseUrl not configured in credential metadata');
    }
    return this.apiRequest(`${this.baseUrl}/api/v1${path}`, options);
  }
}

class ArgoListAppsTool implements ITool {
  constructor(private integration: ArgoCDIntegration) {}
  definition: ToolDefinition = {
    name: 'argocd_list_apps',
    description: 'List all ArgoCD applications and their sync/health status.',
    parameters: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Filter by project name (optional)' },
      },
    },
    category: 'argocd',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const project = args['project'] as string | undefined;
    const params = project ? `?project=${encodeURIComponent(project)}` : '';
    const res = await this.integration.request(`/applications${params}`, { agentId: context.agentId });
    const data = await res.json() as { items: Array<{ metadata: { name: string }; status: { sync: { status: string }; health: { status: string } } }> };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    const apps = (data.items ?? []).map(a => ({
      name: a.metadata?.name,
      syncStatus: a.status?.sync?.status,
      healthStatus: a.status?.health?.status,
    }));
    return { success: true, output: JSON.stringify(apps, null, 2) };
  }
}

class ArgoGetAppTool implements ITool {
  constructor(private integration: ArgoCDIntegration) {}
  definition: ToolDefinition = {
    name: 'argocd_get_app',
    description: 'Get detailed information about an ArgoCD application including sync status, health, and recent history.',
    parameters: {
      type: 'object',
      properties: {
        appName: { type: 'string', description: 'Application name' },
      },
      required: ['appName'],
    },
    category: 'argocd',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const appName = args['appName'] as string;
    const res = await this.integration.request(`/applications/${encodeURIComponent(appName)}`, { agentId: context.agentId });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };

    const spec = data['spec'] as Record<string, unknown> | undefined;
    const status = data['status'] as Record<string, unknown> | undefined;
    return {
      success: true,
      output: JSON.stringify({
        name: (data['metadata'] as Record<string, unknown>)?.['name'],
        project: spec?.['project'],
        source: spec?.['source'],
        destination: spec?.['destination'],
        syncStatus: (status?.['sync'] as Record<string, unknown>)?.['status'],
        healthStatus: (status?.['health'] as Record<string, unknown>)?.['status'],
        history: status?.['history'],
      }, null, 2),
    };
  }
}

class ArgoSyncAppTool implements ITool {
  constructor(private integration: ArgoCDIntegration) {}
  definition: ToolDefinition = {
    name: 'argocd_sync_app',
    description: 'Trigger a sync (deploy) for an ArgoCD application.',
    parameters: {
      type: 'object',
      properties: {
        appName: { type: 'string', description: 'Application name' },
        revision: { type: 'string', description: 'Git revision to sync to (optional, defaults to HEAD)' },
        prune: { type: 'boolean', description: 'Whether to prune resources not in git (default: false)' },
        dryRun: { type: 'boolean', description: 'Dry run without applying (default: false)' },
      },
      required: ['appName'],
    },
    category: 'argocd',
    requiresApproval: true,
    approvalReason: 'Triggering a deployment via ArgoCD sync',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const appName = args['appName'] as string;
    const body: Record<string, unknown> = {};
    if (args['revision']) body['revision'] = args['revision'];
    if (args['prune']) body['prune'] = args['prune'];
    if (args['dryRun']) body['dryRun'] = args['dryRun'];

    const res = await this.integration.request(`/applications/${encodeURIComponent(appName)}/sync`, {
      method: 'POST',
      body,
      agentId: context.agentId,
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `Sync triggered for ${appName}` };
  }
}

class ArgoGetAppHealthTool implements ITool {
  constructor(private integration: ArgoCDIntegration) {}
  definition: ToolDefinition = {
    name: 'argocd_app_health',
    description: 'Get health status and resource details for an ArgoCD application.',
    parameters: {
      type: 'object',
      properties: {
        appName: { type: 'string', description: 'Application name' },
      },
      required: ['appName'],
    },
    category: 'argocd',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const appName = args['appName'] as string;
    const res = await this.integration.request(
      `/applications/${encodeURIComponent(appName)}/resource-tree`,
      { agentId: context.agentId },
    );
    const data = await res.json() as { nodes: Array<{ kind: string; name: string; health?: { status: string; message?: string } }> };
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    const resources = (data.nodes ?? []).map(n => ({
      kind: n.kind,
      name: n.name,
      health: n.health?.status,
      message: n.health?.message,
    }));
    return { success: true, output: JSON.stringify(resources, null, 2) };
  }
}

class ArgoRollbackTool implements ITool {
  constructor(private integration: ArgoCDIntegration) {}
  definition: ToolDefinition = {
    name: 'argocd_rollback',
    description: 'Rollback an ArgoCD application to a previous deployment.',
    parameters: {
      type: 'object',
      properties: {
        appName: { type: 'string', description: 'Application name' },
        deploymentId: { type: 'number', description: 'Deployment ID to rollback to (from app history)' },
      },
      required: ['appName', 'deploymentId'],
    },
    category: 'argocd',
    requiresApproval: true,
    approvalReason: 'Rolling back a deployment in ArgoCD',
  };
  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const appName = args['appName'] as string;
    const res = await this.integration.request(`/applications/${encodeURIComponent(appName)}/rollback`, {
      method: 'POST',
      body: { id: args['deploymentId'] },
      agentId: context.agentId,
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, output: JSON.stringify(data) };
    return { success: true, output: `Rollback triggered for ${appName}` };
  }
}
