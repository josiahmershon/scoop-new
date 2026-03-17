"use client";

import { useEffect, useState } from "react";

interface Conversation {
  id: string;
  name: string;
  updated_at: number;
}

interface ConversationSidebarProps {
  currentId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  refreshKey: number;
}

export function ConversationSidebar({ currentId, onSelect, onNew, refreshKey }: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/chat/conversations");
        if (res.ok) {
          const data = await res.json();
          setConversations(data.data || []);
        }
      } catch (e) {
        console.error("Failed to load conversations", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [refreshKey]);

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={onNew}
          className="w-full rounded-lg border border-gray-600 px-3 py-2 text-sm hover:bg-gray-800 transition-colors"
        >
          + New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <p className="text-gray-500 text-sm p-2">Loading...</p>
        ) : conversations.length === 0 ? (
          <p className="text-gray-500 text-sm p-2">No conversations yet</p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm mb-1 truncate transition-colors ${
                currentId === conv.id
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              {conv.name || "New conversation"}
            </button>
          ))
        )}
      </div>
      <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
        Scoop AI - Blue Bell Creameries
      </div>
    </aside>
  );
}
