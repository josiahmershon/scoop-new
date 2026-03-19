import { NextRequest } from "next/server";
import { listConversations, getMessages, deleteConversation } from "@/lib/db";

const TEMP_USER = "bb-josiah";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");

    // If id provided, return messages for that conversation
    if (id) {
      const messages = getMessages(id);
      return Response.json({
        data: messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
          })),
      });
    }

    // Otherwise list conversations
    const conversations = listConversations(TEMP_USER);
    return Response.json({
      data: conversations.map((c) => ({
        id: c.id,
        name: c.title,
        created_at: c.created_at,
        updated_at: c.updated_at,
      })),
    });
  } catch (error) {
    console.error("Conversations error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }
    deleteConversation(id, TEMP_USER);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
