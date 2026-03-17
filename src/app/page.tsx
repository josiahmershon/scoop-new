"use client";

import { useState, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatInput } from "@/components/chat/ChatInput";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";

export default function Home() {
  const { messages, isStreaming, conversationId, sendMessage, stopStreaming, newConversation, loadConversation } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleNewChat = useCallback(() => {
    newConversation();
    setRefreshKey((k) => k + 1);
  }, [newConversation]);

  const handleSelectConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/conversations?id=${id}`);
      if (res.ok) {
        // For now, just switch to the conversation — messages will load from Dify
        loadConversation(id, []);
      }
    } catch (e) {
      console.error("Failed to load conversation", e);
    }
  }, [loadConversation]);

  const handleSend = useCallback(async (query: string) => {
    await sendMessage(query);
    // Refresh sidebar to show new/updated conversation
    setRefreshKey((k) => k + 1);
  }, [sendMessage]);

  return (
    <div className="flex h-screen">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-50 md:hidden rounded-lg bg-gray-900 p-2 text-white"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <div className={`${sidebarOpen ? "block" : "hidden"} md:block`}>
        <ConversationSidebar
          currentId={conversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          refreshKey={refreshKey}
        />
      </div>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-blue-900">Scoop</h1>
            <p className="text-xs text-gray-500">Blue Bell AI Assistant</p>
          </div>
          <div className="text-xs text-gray-400">
            IT Ticket Assistant
          </div>
        </header>

        {/* Messages */}
        <ChatThread messages={messages} isStreaming={isStreaming} />

        {/* Input */}
        <ChatInput onSend={handleSend} onStop={stopStreaming} isStreaming={isStreaming} />
      </main>
    </div>
  );
}
