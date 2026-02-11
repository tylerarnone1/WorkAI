import type { ToolResult, ToolExecutionContext } from './types.js';
import { ToolRegistry } from './registry.js';
import { ToolExecutionError, NotFoundError } from '../core/errors/index.js';
import { createChildLogger } from '../core/logger/index.js';
import { getOpenFgaAuthorizer } from '../authz/index.js';

const log = createChildLogger({ module: 'tool-executor' });

const DEFAULT_TIMEOUT = 30_000;

export class ToolExecutor {
  private readonly openFgaAuthorizer = getOpenFgaAuthorizer();

  constructor(private registry: ToolRegistry) {}

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const tool = this.registry.get(toolName);
    if (!tool) {
      throw new NotFoundError('Tool', toolName);
    }

    const capabilityGate = await this.checkCapabilityAccess(toolName, args, context);
    if (!capabilityGate.allowed) {
      return {
        success: false,
        output: capabilityGate.message,
        metadata: {
          deniedByPolicy: true,
          missingCapabilities: capabilityGate.missingCapabilities,
        },
      };
    }

    const timeout = tool.definition.timeout ?? DEFAULT_TIMEOUT;
    const start = Date.now();

    log.debug(
      { tool: toolName, agentId: context.agentId, traceId: context.traceId },
      'Executing tool',
    );

    const preApproved =
      !!context.preApprovedAction &&
      context.preApprovedAction.toolName === toolName &&
      this.argsEqual(context.preApprovedAction.args, args);
    if (preApproved) {
      // One-shot pre-approval scoped to the resumed run.
      context.preApprovedAction = undefined;
    }

    // Check if tool requires approval
    if (tool.definition.requiresApproval && !preApproved) {
      const requestId = await context.approvalManager.requestApproval({
        agentId: context.agentId,
        actionType: toolName,
        actionPayload: {
          toolName,
          args,
          resumeContext: {
            conversationId: context.conversationId ?? null,
            traceId: context.traceId,
          },
        },
        reason:
          tool.definition.approvalReason ??
          `Agent wants to execute ${toolName}`,
      });

      return {
        success: true,
        output: `Approval required for ${toolName}. Request ID: ${requestId}. Waiting for human decision.`,
        metadata: {
          approvalPending: true,
          approvalRequestId: requestId,
        },
      };
    }

    return this.executeTool(toolName, args, context, timeout, start);
  }

  private async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
    timeout: number,
    start: number,
  ): Promise<ToolResult> {
    const tool = this.registry.get(toolName);
    if (!tool) {
      throw new NotFoundError('Tool', toolName);
    }

    try {
      const result = await Promise.race<ToolResult>([
        tool.execute(args, context),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new ToolExecutionError(
                  toolName,
                  `Tool execution timed out after ${timeout}ms`,
                ),
              ),
            timeout,
          ),
        ),
      ]);

      log.debug(
        {
          tool: toolName,
          success: result.success,
          durationMs: Date.now() - start,
        },
        'Tool execution completed',
      );

      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown tool execution error';
      log.error(
        { err, tool: toolName, durationMs: Date.now() - start },
        'Tool execution failed',
      );

      return {
        success: false,
        output: `Error executing ${toolName}: ${message}`,
      };
    }
  }

  private async checkCapabilityAccess(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<{
    allowed: boolean;
    message: string;
    missingCapabilities: string[];
  }> {
    const capabilities = context.capabilities;
    if (!capabilities || capabilities.includes('*')) {
      const opaDecision = await this.evaluateOpaPolicy(toolName, args, context);
      if (!opaDecision.allowed) return opaDecision;
      return this.evaluateOpenFgaPolicy(toolName, args, context);
    }

    const required = this.requiredCapabilitiesForTool(toolName, args);
    const missing = required.filter((c) => !capabilities.includes(c));
    if (missing.length === 0) {
      const opaDecision = await this.evaluateOpaPolicy(toolName, args, context);
      if (!opaDecision.allowed) return opaDecision;
      return this.evaluateOpenFgaPolicy(toolName, args, context);
    }

    return {
      allowed: false,
      message: `Policy denied tool "${toolName}". Missing capabilities: ${missing.join(', ')}`,
      missingCapabilities: missing,
    };
  }

  private async evaluateOpenFgaPolicy(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<{
    allowed: boolean;
    message: string;
    missingCapabilities: string[];
  }> {
    if (!this.openFgaAuthorizer.isEnabled()) {
      return { allowed: true, message: '', missingCapabilities: [] };
    }

    const decision = await this.openFgaAuthorizer.check({
      agentId: context.agentId,
      agentName: context.agentName,
      toolName,
      args,
      capabilities: context.capabilities ?? [],
    });
    if (decision.allowed) {
      return { allowed: true, message: '', missingCapabilities: [] };
    }

    return {
      allowed: false,
      message: decision.reason ?? `OpenFGA denied tool "${toolName}"`,
      missingCapabilities: [],
    };
  }

  private async evaluateOpaPolicy(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<{
    allowed: boolean;
    message: string;
    missingCapabilities: string[];
  }> {
    const policyEngine = process.env['POLICY_ENGINE'] ?? 'local';
    const opaUrl = process.env['OPA_POLICY_URL'];
    if (policyEngine !== 'opa' || !opaUrl) {
      return { allowed: true, message: '', missingCapabilities: [] };
    }

    const timeoutMs = Number.parseInt(process.env['OPA_TIMEOUT_MS'] ?? '3000', 10);
    const failOpen = (process.env['OPA_FAIL_OPEN'] ?? 'false').toLowerCase() === 'true';
    const path = process.env['OPA_POLICY_PATH'] ?? '/v1/data/agents/allow';
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const endpoint = `${opaUrl.replace(/\/$/, '')}${normalizedPath}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          input: {
            agentId: context.agentId,
            agentName: context.agentName,
            toolName,
            args,
            capabilities: context.capabilities ?? [],
            conversationId: context.conversationId ?? null,
            traceId: context.traceId,
          },
        }),
      });

      if (!response.ok) {
        const msg = `OPA policy check failed (${response.status}) for tool "${toolName}"`;
        if (failOpen) {
          log.warn({ tool: toolName, status: response.status }, msg);
          return { allowed: true, message: '', missingCapabilities: [] };
        }
        return { allowed: false, message: msg, missingCapabilities: [] };
      }

      const parsed = (await response.json()) as Record<string, unknown>;
      const decision = this.extractOpaDecision(parsed);
      if (decision.allow) {
        return { allowed: true, message: '', missingCapabilities: [] };
      }

      return {
        allowed: false,
        message: decision.reason ?? `OPA denied tool "${toolName}"`,
        missingCapabilities: [],
      };
    } catch (err) {
      const msg = `OPA policy check error for "${toolName}": ${err instanceof Error ? err.message : 'Unknown error'}`;
      if (failOpen) {
        log.warn({ err, tool: toolName }, msg);
        return { allowed: true, message: '', missingCapabilities: [] };
      }
      return { allowed: false, message: msg, missingCapabilities: [] };
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractOpaDecision(data: Record<string, unknown>): {
    allow: boolean;
    reason?: string;
  } {
    const result = data['result'];
    if (typeof result === 'boolean') {
      return { allow: result };
    }
    if (result && typeof result === 'object') {
      const record = result as Record<string, unknown>;
      if (typeof record['allow'] === 'boolean') {
        return {
          allow: record['allow'],
          reason: typeof record['reason'] === 'string' ? record['reason'] : undefined,
        };
      }
      if (typeof record['allowed'] === 'boolean') {
        return {
          allow: record['allowed'],
          reason: typeof record['reason'] === 'string' ? record['reason'] : undefined,
        };
      }
    }
    return { allow: false, reason: 'Invalid OPA response schema' };
  }

  private requiredCapabilitiesForTool(
    toolName: string,
    args: Record<string, unknown>,
  ): string[] {
    if (toolName === 'http_request') return ['network'];
    if (toolName === 'web_search') return ['network'];
    if (toolName === 'persistent_bash' || toolName === 'process_manage') return ['shell'];
    if (toolName === 'browser_screenshot' || toolName === 'file_tree') return ['workspace'];
    if (toolName === 'port_allocate') return ['workspace'];
    if (toolName === 'delegate_task' || toolName === 'agent_message' || toolName === 'ask_colleague') {
      return ['delegation'];
    }
    if (toolName === 'memory_store' && args['shared'] === true) {
      return ['memory:shared:write'];
    }

    // Convention-based integration policy.
    if (/^(github|jira|clickup|gmail|hubspot|argocd|drive|calendar|figma)_/.test(toolName)) {
      if (/(create|update|delete|send|sync|rollback|transition|comment)/.test(toolName)) {
        return ['external:write'];
      }
      return ['external:read'];
    }

    return [];
  }

  private argsEqual(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
  ): boolean {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
}
