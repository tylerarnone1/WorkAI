import type { LLMMessage } from '../llm/types.js';
import type { MemorySearchResult } from '../memory/types.js';
import type { AgentContext } from './types.js';

export function buildMessages(
  input: string,
  conversationHistory: LLMMessage[],
  relevantMemories: MemorySearchResult[],
  context: AgentContext,
): LLMMessage[] {
  const messages: LLMMessage[] = [];

  // Inject relevant memories as context
  if (relevantMemories.length > 0) {
    const memoryContext = relevantMemories
      .map(
        (r) =>
          `[Memory | ${r.entry.memoryType} | similarity: ${Math.round(r.similarity * 100)}%]\n${r.entry.content}`,
      )
      .join('\n\n');

    messages.push({
      role: 'system',
      content: `Relevant memories:\n\n${memoryContext}`,
    });
  }

  // Inject trigger context
  if (context.slackContext) {
    messages.push({
      role: 'system',
      content: `Context: Slack message in channel ${context.slackContext.channel} from user ${context.slackContext.userId}`,
    });
  }

  // Add conversation history
  messages.push(...conversationHistory);

  // Add the new user input
  messages.push({
    role: 'user',
    content: input,
  });

  return messages;
}
