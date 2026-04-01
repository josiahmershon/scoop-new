import type { Tool, ToolCall } from "./vllm";

/**
 * Tool definitions — each maps to a Dify workflow or direct API call.
 * Add new tools here as you build more Dify workflows.
 */
export const TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description:
        "Search Blue Bell Creameries' internal knowledge base for procedures, policies, documentation, UPC transition info, APEX guides, and other company resources. Use this whenever the user asks about company procedures, policies, or needs information that might be in internal docs.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query — be specific and include relevant keywords",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_it_ticket",
      description:
        "Create an IT support ticket in SysAid. Use this when the user has described an IT issue and you have gathered enough information (issue description, affected system, and urgency level). Do NOT call this until you have the details needed.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short ticket title, e.g. 'Outlook - Cannot receive emails'",
          },
          description: {
            type: "string",
            description: "Detailed description of the IT issue",
          },
          urgency: {
            type: "string",
            description: "Urgency level: 1=Low, 2=Normal, 3=High, 4=Urgent, 5=Critical",
            enum: ["1", "2", "3", "4", "5"],
          },
        },
        required: ["title", "description", "urgency"],
      },
    },
  },
];

/**
 * Execute a tool call. Routes to the appropriate handler.
 */
export async function executeTool(toolCall: ToolCall, context?: { userName?: string }): Promise<string> {
  const { name, arguments: argsStr } = toolCall.function;

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsStr);
  } catch {
    return JSON.stringify({ error: "Failed to parse tool arguments" });
  }

  switch (name) {
    case "search_knowledge_base":
      return await searchKnowledgeBase(args);
    case "create_it_ticket":
      return await createItTicket(args, context?.userName);
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

/**
 * Search the knowledge base via Dify workflow.
 */
async function searchKnowledgeBase(args: Record<string, unknown>): Promise<string> {
  const DIFY_API_URL = process.env.DIFY_API_URL!;
  const DIFY_KB_KEY = process.env.DIFY_KB_WORKFLOW_KEY;

  if (!DIFY_KB_KEY) {
    return JSON.stringify({ error: "Knowledge base workflow not configured" });
  }

  try {
    const res = await fetch(`${DIFY_API_URL.replace("/v1", "")}/v1/workflows/run`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DIFY_KB_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: { query: String(args.query) },
        response_mode: "blocking",
        user: "bb-system",
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      return JSON.stringify({ error: `Knowledge base error: ${error}` });
    }

    const data = await res.json();
    const outputs = data.data?.outputs;
    const result = outputs?.result;

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return "No relevant documents found in the knowledge base.";
    }

    // Result might be a string, array of objects, or other format
    if (typeof result === "string") {
      return result;
    }

    if (Array.isArray(result)) {
      // Extract text content from each chunk
      return result
        .map((item: { content?: string; text?: string; [key: string]: unknown }, i: number) => {
          const text = item.content || item.text || JSON.stringify(item);
          return `[${i + 1}] ${text}`;
        })
        .join("\n\n");
    }

    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({ error: `Knowledge base search failed: ${String(error)}` });
  }
}

/**
 * Create an IT ticket via Dify workflow → SysAid.
 */
async function createItTicket(args: Record<string, unknown>, userName?: string): Promise<string> {
  const DIFY_API_URL = process.env.DIFY_API_URL!;
  const DIFY_WORKFLOW_KEY = process.env.DIFY_TICKET_WORKFLOW_KEY;

  if (!DIFY_WORKFLOW_KEY) {
    return JSON.stringify({
      success: false,
      error: "Ticket workflow not configured. Set DIFY_TICKET_WORKFLOW_KEY in .env.local",
    });
  }

  try {
    const res = await fetch(`${DIFY_API_URL.replace("/v1", "")}/v1/workflows/run`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DIFY_WORKFLOW_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          title: String(args.title),
          description: String(args.description),
          urgency: String(args.urgency || "3"),
          requester_name: userName || "Unknown",
        },
        response_mode: "blocking",
        user: "bb-system",
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      return JSON.stringify({ success: false, error: `Workflow error: ${error}` });
    }

    const data = await res.json();
    const outputs = data.data?.outputs;

    if (outputs?.success === "true") {
      return JSON.stringify({
        success: true,
        ticket_id: outputs.ticket_id,
        message: `IT ticket #${outputs.ticket_id} has been created successfully.`,
      });
    }

    return JSON.stringify({
      success: false,
      error: outputs?.error || "Unknown error creating ticket",
    });
  } catch (error) {
    return JSON.stringify({ success: false, error: String(error) });
  }
}
