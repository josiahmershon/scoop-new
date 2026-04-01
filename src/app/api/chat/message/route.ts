import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { runAgent, type ChatMessage } from "@/lib/agent";
import { chatCompletion } from "@/lib/vllm";
import {
  createConversation,
  getConversation,
  getMessages,
  addMessage,
  touchConversation,
  updateConversationTitle,
} from "@/lib/db";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const sessionUser = session?.user as Record<string, unknown> | undefined;
    const userId = sessionUser?.id as string || "bb-josiah";
    const userName = sessionUser?.name as string || "Unknown";

    const { query, conversationId } = await req.json();

    if (!query || typeof query !== "string") {
      return Response.json({ error: "query is required" }, { status: 400 });
    }

    // Get or create conversation
    let convId = conversationId;
    let isNew = false;

    if (convId) {
      const existing = getConversation(convId, userId);
      if (!existing) {
        return Response.json({ error: "Conversation not found" }, { status: 404 });
      }
    } else {
      convId = randomUUID();
      createConversation(userId, convId);
      isNew = true;
    }

    // Load existing messages for context
    const dbMessages = getMessages(convId);
    const history: ChatMessage[] = dbMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Add new user message
    history.push({ role: "user", content: query });
    addMessage(randomUUID(), convId, "user", query);

    // Generate title in background (don't block response)
    if (isNew) {
      generateTitle(query, convId);
    }

    // Run agent
    const { stream } = await runAgent(history, { userName });

    // Save assistant response after stream completes
    const [clientStream, captureStream] = stream.tee();
    captureResponse(captureStream, convId);

    return new Response(clientStream, {
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

/**
 * Read the captured stream to save the assistant's full response to the DB.
 */
async function captureResponse(stream: ReadableStream<Uint8Array>, convId: string) {
  try {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data) continue;

        try {
          const event = JSON.parse(data);
          if (event.event === "message" && event.answer) {
            fullText += event.answer;
          }
        } catch {
          continue;
        }
      }
    }

    if (fullText) {
      addMessage(randomUUID(), convId, "assistant", fullText);
      touchConversation(convId);
    }
  } catch (error) {
    console.error("Failed to capture response:", error);
  }
}

/**
 * Generate a smart conversation title using vLLM.
 * Returns the title string.
 */
async function generateTitle(userMessage: string, convId: string): Promise<void> {
  try {
    const response = await chatCompletion([
      {
        role: "system",
        content: "Generate a very short title (3-6 words max) for a conversation that starts with the following message. Reply with ONLY the title, no quotes, no punctuation at the end.",
      },
      { role: "user", content: userMessage },
    ]);

    let title = response.choices[0]?.message?.content?.trim() || "";
    const closeIdx = title.indexOf("</think>");
    if (closeIdx !== -1) {
      title = title.slice(closeIdx + 8).trim();
    }
    if (title) {
      updateConversationTitle(convId, title);
    }
  } catch (error) {
    console.error("Failed to generate title:", error);
    updateConversationTitle(convId, userMessage.slice(0, 50));
  }
}
