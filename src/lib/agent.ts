import { chatCompletion, type ChatMessage } from "./vllm";
import { TOOLS, executeTool } from "./tools";

export type { ChatMessage } from "./vllm";

const SYSTEM_PROMPT = `You are Scoop, Blue Bell Creameries' friendly and helpful AI assistant.

You assist employees with IT issues, answer questions about company procedures, and help with day-to-day tasks.

You have access to tools. Use them when appropriate:
- When a user asks about company procedures, policies, UPC transitions, APEX, or anything that might be in internal documentation, use search_knowledge_base to look it up. Always search before answering questions about Blue Bell-specific topics.
- When a user describes an IT issue and you've gathered enough details (what's wrong, what system, how urgent), use create_it_ticket to submit a SysAid ticket.
- Do NOT create a ticket until you have a clear description of the issue. Ask follow-up questions first if needed.
- If you can answer a general question directly (not Blue Bell-specific), just respond — no need to use a tool.

When you use search_knowledge_base and get results, synthesize the information into a clear, helpful answer. Cite specific details from the results. If no relevant results are found, let the user know and offer to help another way.

Be conversational, concise, and helpful. You represent Blue Bell Creameries — be warm and professional.
Do not include internal reasoning or thinking in your response.`;

const MAX_TOOL_ROUNDS = 5;

interface AgentResult {
  stream: ReadableStream<Uint8Array>;
  conversationMessages: ChatMessage[];
}

/**
 * Strip thinking content from model output.
 * The model may output thinking without <think> but always closes with </think>.
 */
function stripThinking(text: string): string {
  // If there's a </think> tag, everything before and including it is thinking
  const closeIdx = text.indexOf("</think>");
  if (closeIdx !== -1) {
    return text.slice(closeIdx + 8).trim();
  }
  // Also handle <think>...</think> blocks
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
}

/**
 * Run the agent loop:
 * 1. Send messages + tools to vLLM (non-streaming)
 * 2. If vLLM returns tool calls, execute them and loop
 * 3. When vLLM returns text, send it as a stream to the client
 */
export async function runAgent(
  userMessages: ChatMessage[],
  context?: { userName?: string }
): Promise<AgentResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...userMessages,
  ];

  // Agent loop: handle tool calls
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await chatCompletion(messages, TOOLS);
    const choice = response.choices[0];

    if (!choice) {
      throw new Error("No response from vLLM");
    }

    const { message } = choice;
    const cleanContent = stripThinking(message.content || "");

    // If no tool calls, we're done — send the text response
    if (!message.tool_calls || message.tool_calls.length === 0) {
      // Add assistant response to conversation history
      messages.push({ role: "assistant", content: cleanContent });

      const stream = textToSSEStream(cleanContent);
      return { stream, conversationMessages: messages };
    }

    // Add assistant message with tool calls
    messages.push({
      role: "assistant",
      content: cleanContent,
      tool_calls: message.tool_calls,
    });

    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      message.tool_calls.map(async (toolCall) => {
        const result = await executeTool(toolCall, context);
        return {
          role: "tool" as const,
          content: result,
          tool_call_id: toolCall.id,
        };
      })
    );

    // Add tool results to messages
    messages.push(...toolResults);
  }

  // If we hit max rounds, do one final call without tools
  const response = await chatCompletion(messages);
  const content = stripThinking(response.choices[0]?.message?.content || "Something went wrong.");
  messages.push({ role: "assistant", content });

  const stream = textToSSEStream(content);
  return { stream, conversationMessages: messages };
}

/**
 * Convert a text string to an SSE stream (single event).
 */
function textToSSEStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let sent = false;

  return new ReadableStream({
    pull(controller) {
      if (sent) {
        controller.close();
        return;
      }
      sent = true;
      const event = JSON.stringify({
        event: "message",
        answer: text,
      });
      controller.enqueue(encoder.encode(`data: ${event}\n\n`));
    },
  });
}
