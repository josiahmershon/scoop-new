"use client";

import { useState, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatInput } from "@/components/chat/ChatInput";

export default function Home() {
  const { messages, isStreaming, sendMessage, stopStreaming, newConversation } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleNewChat = useCallback(() => {
    newConversation();
  }, [newConversation]);

  const handleSend = useCallback(async (query: string) => {
    await sendMessage(query);
  }, [sendMessage]);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "block" : "hidden"} md:block w-64 bg-gray-900 text-white flex flex-col h-full`}>
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={handleNewChat}
            className="w-full rounded-lg border border-gray-600 px-3 py-2 text-sm hover:bg-gray-800 transition-colors"
          >
            + New chat
          </button>
        </div>
        <div className="flex-1" />
        <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
          Scoop AI - Blue Bell Creameries
        </div>
      </aside>

      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-50 md:hidden rounded-lg bg-gray-900 p-2 text-white"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-blue-900">Scoop</h1>
            <p className="text-xs text-gray-500">Blue Bell AI Assistant</p>
          </div>
        </header>

        <ChatThread messages={messages} isStreaming={isStreaming} />
        <ChatInput onSend={handleSend} onStop={stopStreaming} isStreaming={isStreaming} />
      </main>
    </div>
  );
}
