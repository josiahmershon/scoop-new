import { NextRequest } from "next/server";
import { runAgent, type ChatMessage } from "@/lib/agent";

// Hardcoded user for now — will be replaced with session user from next-auth
const TEMP_USER = "bb-josiah";

// In-memory conversation store (temporary — will be replaced with DB)
const conversations = new Map<string, ChatMessage[]>();

export async function POST(req: NextRequest) {
  try {
    const { query, conversationId } = await req.json();

    if (!query || typeof query !== "string") {
      return Response.json({ error: "query is required" }, { status: 400 });
    }

    // Get or create conversation history
    const convId = conversationId || `conv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const history = conversations.get(convId) || [];

    // Add user message
    history.push({ role: "user", content: query });

    // Run agent loop
    const { stream, conversationMessages } = await runAgent(history);

    // Store updated history (strip system prompt)
    conversations.set(
      convId,
      conversationMessages.filter((m) => m.role !== "system")
    );

    // Stream response with conversation ID header
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Conversation-Id": convId,
      },
    });
  } catch (error) {
    console.error("Chat message error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
