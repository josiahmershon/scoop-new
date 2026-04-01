import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { listConversations, getMessages, deleteConversation } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = (session?.user as Record<string, unknown>)?.id as string || "bb-josiah";

    const id = req.nextUrl.searchParams.get("id");

    if (id) {
      const messages = getMessages(id);
      return Response.json({
        data: messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            feedback: m.feedback || null,
            created_at: m.created_at,
          })),
      });
    }

    const conversations = listConversations(userId);
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
    const session = await auth();
    const userId = (session?.user as Record<string, unknown>)?.id as string || "bb-josiah";

    const { id } = await req.json();
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }
    deleteConversation(id, userId);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
