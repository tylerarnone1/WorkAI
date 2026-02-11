import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolRegistry } from './registry.js';
import { ToolExecutor } from './executor.js';
import type { ITool, ToolExecutionContext, ToolResult } from './types.js';

class DummyTool implements ITool {
  definition = {
    name: 'http_request',
    description: 'dummy',
    parameters: { type: 'object' as const, properties: {} },
    category: 'test',
  };

  async execute(): Promise<ToolResult> {
    return { success: true, output: 'ok' };
  }
}

const baseContext = (): ToolExecutionContext => ({
  agentId: 'agent-1',
  agentName: 'Agent 1',
  conversationId: 'conv-1',
  traceId: 'trace-1',
  memoryManager: {} as ToolExecutionContext['memoryManager'],
  approvalManager: {} as ToolExecutionContext['approvalManager'],
});

describe('ToolExecutor policy gates', () => {
  afterEach(() => {
    delete process.env['POLICY_ENGINE'];
    delete process.env['OPA_POLICY_URL'];
    delete process.env['OPA_POLICY_PATH'];
    delete process.env['OPA_TIMEOUT_MS'];
    delete process.env['OPA_FAIL_OPEN'];
    delete process.env['AUTHZ_ENGINE'];
    delete process.env['OPENFGA_API_URL'];
    delete process.env['OPENFGA_STORE_ID'];
    delete process.env['OPENFGA_MODEL_ID'];
    delete process.env['OPENFGA_API_TOKEN'];
    delete process.env['OPENFGA_FAIL_OPEN'];
    delete process.env['OPENFGA_DEFAULT_RELATION'];
    vi.restoreAllMocks();
  });

  it('denies when local capability is missing', async () => {
    const registry = new ToolRegistry();
    registry.register(new DummyTool());
    const executor = new ToolExecutor(registry);

    const result = await executor.execute(
      'http_request',
      { url: 'https://example.com' },
      { ...baseContext(), capabilities: ['delegation'] },
    );

    expect(result.success).toBe(false);
    expect(result.output).toContain('Missing capabilities');
  });

  it('allows local capability and then denies via OPA', async () => {
    process.env['POLICY_ENGINE'] = 'opa';
    process.env['OPA_POLICY_URL'] = 'http://opa.local';
    process.env['OPA_POLICY_PATH'] = '/v1/data/agents/allow';

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: { allow: false, reason: 'policy deny' } }),
    } as unknown as Response);

    const registry = new ToolRegistry();
    registry.register(new DummyTool());
    const executor = new ToolExecutor(registry);

    const result = await executor.execute(
      'http_request',
      { url: 'https://example.com' },
      { ...baseContext(), capabilities: ['network'] },
    );

    expect(result.success).toBe(false);
    expect(result.output).toContain('policy deny');
  });

  it('denies via OpenFGA when enabled but not configured', async () => {
    process.env['AUTHZ_ENGINE'] = 'openfga';

    const registry = new ToolRegistry();
    registry.register(new DummyTool());
    const executor = new ToolExecutor(registry);

    const result = await executor.execute(
      'http_request',
      { url: 'https://example.com' },
      { ...baseContext(), capabilities: ['network'] },
    );

    expect(result.success).toBe(false);
    expect(result.output).toContain('OpenFGA authz is enabled');
  });
});
