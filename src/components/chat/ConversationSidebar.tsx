"use client";

import { useEffect, useState } from "react";

interface Conversation {
  id: string;
  name: string;
  updated_at: string;
}

interface ConversationSidebarProps {
  currentId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  refreshKey: number;
}

export function ConversationSidebar({ currentId, onSelect, onNew, onDelete, refreshKey }: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

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
      }
    }
    load();
  }, [refreshKey]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch("/api/chat/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      onDelete(id);
    } catch (e) {
      console.error("Failed to delete conversation", e);
    }
  };

  return (
    <>
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={`w-full group flex items-center gap-2 rounded-lg px-3 py-2 text-sm mb-0.5 transition-colors ${
            currentId === conv.id
              ? "bg-gray-700 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="flex-1 truncate text-left">{conv.name || "New chat"}</span>
          <button
            onClick={(e) => handleDelete(e, conv.id)}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-opacity"
            title="Delete conversation"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </button>
      ))}
    </>
  );
}
