import { getConversations } from "@/lib/dify";

const TEMP_USER = "bb-josiah";

export async function GET() {
  try {
    const data = await getConversations(TEMP_USER);
    return Response.json(data);
  } catch (error) {
    console.error("Get conversations error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
