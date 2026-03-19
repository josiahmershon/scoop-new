import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DATABASE_URL?.replace("file:", "") || path.join(process.cwd(), "scoop.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initTables(db);
  }
  return db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT DEFAULT 'New chat',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      tool_call_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
  `);
}

// --- Conversations ---

export function createConversation(userId: string, id: string): void {
  const db = getDb();
  db.prepare("INSERT INTO conversations (id, user_id) VALUES (?, ?)").run(id, userId);
}

export function getConversation(id: string, userId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?").get(id, userId) as {
    id: string; user_id: string; title: string; created_at: string; updated_at: string;
  } | undefined;
}

export function listConversations(userId: string) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50"
  ).all(userId) as Array<{
    id: string; user_id: string; title: string; created_at: string; updated_at: string;
  }>;
}

export function updateConversationTitle(id: string, title: string): void {
  const db = getDb();
  db.prepare("UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, id);
}

export function deleteConversation(id: string, userId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?").run(id, userId);
}

export function touchConversation(id: string): void {
  const db = getDb();
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(id);
}

// --- Messages ---

export function addMessage(
  id: string,
  conversationId: string,
  role: string,
  content: string,
  toolCalls?: string,
  toolCallId?: string
): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_call_id) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, conversationId, role, content, toolCalls || null, toolCallId || null);
}

export function getMessages(conversationId: string) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
  ).all(conversationId) as Array<{
    id: string; conversation_id: string; role: string; content: string;
    tool_calls: string | null; tool_call_id: string | null; created_at: string;
  }>;
}
