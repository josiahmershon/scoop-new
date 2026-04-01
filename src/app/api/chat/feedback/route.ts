import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { updateMessageFeedback } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId, rating } = await req.json();

    if (!messageId) {
      return Response.json({ error: "messageId is required" }, { status: 400 });
    }

    if (rating !== "like" && rating !== "dislike" && rating !== null) {
      return Response.json({ error: "rating must be 'like', 'dislike', or null" }, { status: 400 });
    }

    updateMessageFeedback(messageId, rating);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Feedback error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
