import type { Tool, ToolCall } from "./vllm";

/**
 * Tool definitions — each maps to a Dify workflow or direct API call.
 * Add new tools here as you build more Dify workflows.
 */
export const TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "create_it_ticket",
      description:
        "Create an IT support ticket in SysAid. Use this when the user has described an IT issue and you have gathered enough information (issue description, affected system, and urgency level). Do NOT call this until you have the details needed.",
      parameters: {
        type: "object",
        properties: {
          issue: {
            type: "string",
            description: "Clear description of the IT issue",
          },
          system: {
            type: "string",
            description: "The affected system or application (e.g. Outlook, VPN, Monitor, Printer, SAP, APEX)",
          },
          urgency: {
            type: "number",
            description: "Urgency level: 1=Low, 2=Normal, 3=High, 4=Urgent, 5=Critical",
            enum: [1, 2, 3, 4, 5],
          },
        },
        required: ["issue", "system", "urgency"],
      },
    },
  },
  // Future tools — uncomment as you build Dify workflows:
  //
  // {
  //   type: "function",
  //   function: {
  //     name: "search_knowledge_base",
  //     description: "Search Blue Bell's internal knowledge base for procedures, policies, and documentation.",
  //     parameters: {
  //       type: "object",
  //       properties: {
  //         query: { type: "string", description: "Search query" },
  //       },
  //       required: ["query"],
  //     },
  //   },
  // },
  //
  // {
  //   type: "function",
  //   function: {
  //     name: "check_ticket_status",
  //     description: "Check the status of an existing IT support ticket by ticket ID.",
  //     parameters: {
  //       type: "object",
  //       properties: {
  //         ticket_id: { type: "string", description: "The SysAid ticket ID number" },
  //       },
  //       required: ["ticket_id"],
  //     },
  //   },
  // },
];

/**
 * Execute a tool call. Routes to the appropriate handler.
 */
export async function executeTool(toolCall: ToolCall): Promise<string> {
  const { name, arguments: argsStr } = toolCall.function;

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsStr);
  } catch {
    return JSON.stringify({ error: "Failed to parse tool arguments" });
  }

  switch (name) {
    case "create_it_ticket":
      return await createItTicket(args);
    // case "search_knowledge_base":
    //   return await searchKnowledgeBase(args);
    // case "check_ticket_status":
    //   return await checkTicketStatus(args);
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

/**
 * Create an IT ticket via Dify workflow (or direct SysAid API).
 * TODO: Replace with Dify workflow call once the workflow is created.
 * For now, calls SysAid directly.
 */
async function createItTicket(args: Record<string, unknown>): Promise<string> {
  const DIFY_API_URL = process.env.DIFY_API_URL!;
  const DIFY_WORKFLOW_KEY = process.env.DIFY_TICKET_WORKFLOW_KEY;

  // If a Dify workflow key is configured, use it
  if (DIFY_WORKFLOW_KEY) {
    try {
      const res = await fetch(`${DIFY_API_URL.replace("/v1", "")}/v1/workflows/run`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${DIFY_WORKFLOW_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {
            issue: args.issue,
            system: args.system,
            urgency: String(args.urgency),
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
      return JSON.stringify(data.data?.outputs || { success: true, result: "Workflow completed" });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  // Fallback: no workflow configured yet
  return JSON.stringify({
    success: false,
    error: "Ticket workflow not configured. Set DIFY_TICKET_WORKFLOW_KEY in .env.local",
  });
}
