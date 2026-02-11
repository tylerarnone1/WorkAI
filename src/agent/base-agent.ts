import { randomUUID } from 'node:crypto';
import type { AgentConfig } from '../core/config/types.js';
import type { LLMClient } from '../llm/client.js';
import type { LLMMessage, ToolCallResult, TokenUsage } from '../llm/types.js';
import type { MemoryManager } from '../memory/memory-manager.js';
import type { ToolRegistry } from '../tools/registry.js';
import { ToolExecutor } from '../tools/executor.js';
import type { ToolExecutionContext } from '../tools/types.js';
import type { ApprovalManager } from '../approval/approval-manager.js';
import type { EventBus } from '../core/events/emitter.js';
import type { AgentContext, AgentRunResult, AgentState } from './types.js';
import { buildMessages } from './context-builder.js';
import { createChildLogger } from '../core/logger/index.js';
import type { AgentRunObservation } from '../observability/types.js';
import { NoopObservability } from '../observability/noop-observability.js';

export interface BaseAgentDeps {
  config: AgentConfig;
  llmClient: LLMClient;
  memoryManager: MemoryManager;
  toolRegistry: ToolRegistry;
  approvalManager: ApprovalManager;
  eventBus: EventBus;
  observability?: AgentRunObservation;
}

const log = createChildLogger({ module: 'base-agent' });

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected llmClient: LLMClient;
  protected memoryManager: MemoryManager;
  protected toolRegistry: ToolRegistry;
  protected toolExecutor: ToolExecutor;
  protected approvalManager: ApprovalManager;
  protected eventBus: EventBus;
  protected observability: AgentRunObservation;
  private _state: AgentState = 'idle';

  constructor(deps: BaseAgentDeps) {
    this.config = deps.config;
    this.llmClient = deps.llmClient;
    this.memoryManager = deps.memoryManager;
    this.toolRegistry = deps.toolRegistry;
    this.toolExecutor = new ToolExecutor(deps.toolRegistry);
    this.approvalManager = deps.approvalManager;
    this.eventBus = deps.eventBus;
    this.observability = deps.observability ?? new NoopObservability();
  }

  get state(): AgentState {
    return this._state;
  }

  get name(): string {
    return this.config.name;
  }

  get displayName(): string {
    return this.config.displayName;
  }

  async run(input: string, context: AgentContext): Promise<AgentRunResult> {
    const maxIterations = this.config.maxIterations ?? 10;
    let iterations = 0;
    const toolsUsed: string[] = [];
    const totalUsage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    const startTime = Date.now();
    let runObservation: unknown = undefined;

    log.info(
      {
        agent: this.config.name,
        trigger: context.trigger,
        traceId: context.traceId,
      },
      'Agent run started',
    );

    try {
      runObservation = await this.observability.start({
        agentId: this.config.name,
        agentName: this.config.displayName,
        prompt: input,
        context,
      });

      // Step 1: Retrieve context
      const conversationHistory =
        await this.memoryManager.getConversationHistory(
          context.conversationId,
        );

      const relevantMemories = await this.memoryManager
        .recall(input, 5)
        .catch(() => []);

      // Build initial messages
      const messages = buildMessages(
        input,
        conversationHistory,
        relevantMemories,
        context,
      );

      // Store user message
      await this.memoryManager.addToConversation(context.conversationId, {
        role: 'user',
        content: input,
      });

      // Get system prompt (allow subclass override)
      const systemPrompt = await this.buildSystemPrompt(context);

      // Get available tools
      const tools = this.toolRegistry.toUnifiedDefinitions(this.config.tools);

      while (iterations < maxIterations) {
        iterations++;
        this._state = 'thinking';

        // Allow subclass to modify messages before LLM call
        const finalMessages = await this.beforeLLMCall(messages, context);

        // Step 2: Call LLM
        const response = await this.llmClient.complete({
          messages: finalMessages,
          systemPrompt,
          tools: tools.length > 0 ? tools : undefined,
          temperature: this.config.llmTemperature,
          maxTokens: this.config.llmMaxTokens,
        });

        totalUsage.promptTokens += response.usage.promptTokens;
        totalUsage.completionTokens += response.usage.completionTokens;
        totalUsage.totalTokens += response.usage.totalTokens;

        // Step 3: No tool calls = final response
        if (
          response.toolCalls.length === 0 ||
          response.finishReason === 'stop'
        ) {
          this._state = 'responding';

          await this.memoryManager.addToConversation(
            context.conversationId,
            { role: 'assistant', content: response.content },
          );

          await this.onRunComplete(response.content, context);

          await this.observability.finish(runObservation, {
            success: true,
            response: response.content,
            toolsUsed,
            tokenUsage: totalUsage,
            iterations,
            durationMs: Date.now() - startTime,
            approvalsPending: [],
          });

          this._state = 'idle';
          return {
            success: true,
            response: response.content,
            toolsUsed,
            tokenUsage: totalUsage,
            iterations,
            durationMs: Date.now() - startTime,
            approvalsPending: [],
          };
        }

        // Step 4: Execute tool calls
        this._state = 'executing_tool';
        const toolResults: ToolCallResult[] = [];
        const rawPreApproved =
          context.triggerPayload?.['preApprovedAction'] as
            | Record<string, unknown>
            | undefined;
        const toolContext: ToolExecutionContext = {
          agentId: context.agentId,
          agentName: context.agentName,
          conversationId: context.conversationId,
          traceId: context.traceId,
          memoryManager: this.memoryManager,
          approvalManager: this.approvalManager,
          capabilities: this.getExecutionCapabilities(),
          preApprovedAction:
            rawPreApproved &&
            typeof rawPreApproved['requestId'] === 'string' &&
            typeof rawPreApproved['toolName'] === 'string' &&
            typeof rawPreApproved['args'] === 'object'
              ? {
                  requestId: rawPreApproved['requestId'],
                  toolName: rawPreApproved['toolName'],
                  args: rawPreApproved['args'] as Record<string, unknown>,
                }
              : undefined,
        };

        for (const toolCall of response.toolCalls) {
          toolsUsed.push(toolCall.name);
          const toolStart = Date.now();

          const result = await this.toolExecutor.execute(
            toolCall.name,
            toolCall.arguments,
            toolContext,
          );

          await this.observability.observeTool(runObservation, {
            toolName: toolCall.name,
            args: toolCall.arguments,
            result,
            durationMs: Date.now() - toolStart,
          });

          // Check if tool is waiting for approval
          if (result.metadata?.['approvalPending']) {
            this._state = 'waiting_approval';

            await this.memoryManager.addToConversation(
              context.conversationId,
              { role: 'assistant', content: response.content },
            );

            await this.observability.finish(runObservation, {
              success: true,
              response: `Approval required. ${result.output}`,
              toolsUsed,
              tokenUsage: totalUsage,
              iterations,
              durationMs: Date.now() - startTime,
              approvalsPending: [result.metadata['approvalRequestId'] as string],
            });

            return {
              success: true,
              response: `Approval required. ${result.output}`,
              toolsUsed,
              tokenUsage: totalUsage,
              iterations,
              durationMs: Date.now() - startTime,
              approvalsPending: [
                result.metadata['approvalRequestId'] as string,
              ],
            };
          }

          toolResults.push({
            toolCallId: toolCall.id,
            name: toolCall.name,
            result: result.output,
            isError: !result.success,
          });
        }

        // Step 5: Add assistant + tool results to messages
        messages.push({
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls,
        });

        for (const result of toolResults) {
          messages.push({
            role: 'tool',
            content: result.result,
            toolCallId: result.toolCallId,
          });
        }
      }

      // Max iterations
      this._state = 'error';
      log.warn(
        { agent: this.config.name, iterations },
        'Max iterations reached',
      );

      await this.observability.finish(runObservation, {
        success: false,
        response: 'Maximum iterations reached without a final response.',
        toolsUsed,
        tokenUsage: totalUsage,
        iterations,
        durationMs: Date.now() - startTime,
        approvalsPending: [],
      });

      return {
        success: false,
        response: 'Maximum iterations reached without a final response.',
        toolsUsed,
        tokenUsage: totalUsage,
        iterations,
        durationMs: Date.now() - startTime,
        approvalsPending: [],
      };
    } catch (err) {
      this._state = 'error';
      log.error({ err, agent: this.config.name }, 'Agent run failed');
      await this.observability.fail(runObservation, err);

      return {
        success: false,
        response: `Agent error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        toolsUsed,
        tokenUsage: totalUsage,
        iterations,
        durationMs: Date.now() - startTime,
        approvalsPending: [],
      };
    }
  }

  // --- Extension Points ---

  protected async buildSystemPrompt(_context: AgentContext): Promise<string> {
    const parts = [this.config.systemPrompt];
    if (this.config.personality) {
      parts.push(`\nPersonality: ${this.config.personality}`);
    }
    parts.push(
      `\nYour name is ${this.config.displayName}. Today is ${new Date().toISOString().split('T')[0]}.`,
    );

    // Inject org context if configured
    if (this.config.role || this.config.team) {
      const orgParts: string[] = ['\n\n## Your Role & Team'];
      if (this.config.role) orgParts.push(`Role: ${this.config.role}`);
      if (this.config.team) orgParts.push(`Team: ${this.config.team}`);
      if (this.config.reportsTo) orgParts.push(`Reports to: @${this.config.reportsTo}`);
      if (this.config.expertise && this.config.expertise.length > 0) {
        orgParts.push(`Expertise: ${this.config.expertise.join(', ')}`);
      }

      orgParts.push('\nYou can collaborate with colleagues using:');
      orgParts.push('- `find_expert` - Find teammates with specific skills');
      orgParts.push('- `ask_colleague` - Send a message or mention someone in Slack');
      orgParts.push('- `delegate_task` - Assign work to another agent');

      parts.push(orgParts.join('\n'));
    }

    return parts.join('');
  }

  protected async beforeLLMCall(
    messages: LLMMessage[],
    _context: AgentContext,
  ): Promise<LLMMessage[]> {
    return messages;
  }

  protected async onRunComplete(
    _response: string,
    _context: AgentContext,
  ): Promise<void> {
    // Override in subclasses
  }

  protected async onToolError(
    _toolName: string,
    _error: Error,
    _context: AgentContext,
  ): Promise<void> {
    // Override in subclasses
  }

  private getExecutionCapabilities(): string[] | undefined {
    const capabilities = this.config.metadata?.['executionCapabilities'];
    if (!Array.isArray(capabilities)) return undefined;
    const normalized = capabilities.filter((c): c is string => typeof c === 'string');
    return normalized.length > 0 ? normalized : undefined;
  }

  // --- Convenience ---

  async createConversation(
    externalId?: string,
    channel?: string,
    userId?: string,
  ): Promise<string> {
    return this.memoryManager.createConversation(externalId, channel, userId);
  }

  async findOrCreateConversation(
    externalId: string,
    channel?: string,
    userId?: string,
  ): Promise<string> {
    const existing = await this.memoryManager.findConversation(
      externalId,
      channel,
    );
    if (existing) return existing;
    return this.memoryManager.createConversation(externalId, channel, userId);
  }

  createContext(
    conversationId: string,
    trigger: AgentContext['trigger'],
    overrides?: Partial<AgentContext>,
  ): AgentContext {
    return {
      agentId: this.config.name,
      agentName: this.config.displayName,
      traceId: randomUUID(),
      conversationId,
      trigger,
      ...overrides,
    };
  }
}
