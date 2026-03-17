const VLLM_API_URL = process.env.VLLM_API_URL || "http://10.100.175.63:8000/v1";
const VLLM_MODEL = process.env.VLLM_MODEL || "Qwen/Qwen3.5-35B-A3B-GPTQ-Int4";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface VLLMResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
}

/**
 * Call vLLM for a non-streaming completion (used in agent loop for tool-call rounds)
 */
export async function chatCompletion(
  messages: ChatMessage[],
  tools?: Tool[]
): Promise<VLLMResponse> {
  const body: Record<string, unknown> = {
    model: VLLM_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const res = await fetch(`${VLLM_API_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`vLLM error ${res.status}: ${error}`);
  }

  return res.json();
}

/**
 * Call vLLM for a streaming completion (used for final response to user)
 */
export async function chatCompletionStream(
  messages: ChatMessage[],
  tools?: Tool[]
): Promise<Response> {
  const body: Record<string, unknown> = {
    model: VLLM_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 4096,
    stream: true,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const res = await fetch(`${VLLM_API_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`vLLM error ${res.status}: ${error}`);
  }

  return res;
}
