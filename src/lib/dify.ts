const DIFY_API_URL = process.env.DIFY_API_URL!;
const DIFY_API_KEY = process.env.DIFY_API_KEY!;

interface SendMessageParams {
  query: string;
  user: string;
  conversationId?: string;
}

export async function sendMessage({ query, user, conversationId }: SendMessageParams) {
  const body: Record<string, unknown> = {
    inputs: {},
    query,
    response_mode: "streaming",
    user,
  };

  if (conversationId) {
    body.conversation_id = conversationId;
  }

  const res = await fetch(`${DIFY_API_URL}/chat-messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${DIFY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Dify API error ${res.status}: ${error}`);
  }

  return res;
}

export async function getConversations(user: string) {
  const res = await fetch(
    `${DIFY_API_URL}/conversations?user=${encodeURIComponent(user)}&limit=100&sort_by=-updated_at`,
    {
      headers: {
        "Authorization": `Bearer ${DIFY_API_KEY}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Dify API error ${res.status}`);
  }

  return res.json();
}

export async function getMessages(conversationId: string, user: string) {
  const res = await fetch(
    `${DIFY_API_URL}/messages?conversation_id=${conversationId}&user=${encodeURIComponent(user)}&limit=100`,
    {
      headers: {
        "Authorization": `Bearer ${DIFY_API_KEY}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Dify API error ${res.status}`);
  }

  return res.json();
}

export async function deleteConversation(conversationId: string, user: string) {
  const res = await fetch(
    `${DIFY_API_URL}/conversations/${conversationId}`,
    {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${DIFY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user }),
    }
  );

  if (!res.ok) {
    throw new Error(`Dify API error ${res.status}`);
  }
}

export async function sendFeedback(messageId: string, rating: "like" | "dislike" | null, user: string) {
  const res = await fetch(
    `${DIFY_API_URL}/messages/${messageId}/feedbacks`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DIFY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rating, user }),
    }
  );

  if (!res.ok) {
    throw new Error(`Dify API error ${res.status}`);
  }
}
