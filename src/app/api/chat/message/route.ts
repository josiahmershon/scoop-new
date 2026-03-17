import { NextRequest } from "next/server";
import { sendMessage } from "@/lib/dify";

// Hardcoded user for now — will be replaced with session user from next-auth
const TEMP_USER = "bb-josiah";

export async function POST(req: NextRequest) {
  try {
    const { query, conversationId } = await req.json();

    if (!query || typeof query !== "string") {
      return Response.json({ error: "query is required" }, { status: 400 });
    }

    const difyRes = await sendMessage({
      query,
      user: TEMP_USER,
      conversationId,
    });

    // Forward the SSE stream directly to the client
    return new Response(difyRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
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
