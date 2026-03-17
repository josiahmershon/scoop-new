import { NextRequest } from "next/server";
import { sendFeedback } from "@/lib/dify";

const TEMP_USER = "bb-josiah";

export async function POST(req: NextRequest) {
  try {
    const { messageId, rating } = await req.json();

    if (!messageId) {
      return Response.json({ error: "messageId is required" }, { status: 400 });
    }

    await sendFeedback(messageId, rating, TEMP_USER);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Feedback error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
