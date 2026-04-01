"use client";

import { useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatInput } from "@/components/chat/ChatInput";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";

export default function Home() {
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { messages, isStreaming, conversationId, sendMessage, stopStreaming, newConversation, loadConversation } = useChat();

  const handleNewChat = useCallback(() => {
    newConversation();
  }, [newConversation]);

  const handleSelectConversation = useCallback((id: string) => {
    loadConversation(id);
  }, [loadConversation]);

  const handleDeleteConversation = useCallback((id: string) => {
    if (conversationId === id) {
      newConversation();
    }
  }, [conversationId, newConversation]);

  const handleSend = useCallback(async (query: string) => {
    await sendMessage(query);
  }, [sendMessage]);

  // Redirect to login if not authenticated
  if (status === "unauthenticated") {
    redirect("/login");
  }

  // Show loading while checking session
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  const user = session?.user;
  const sessionUser = user as Record<string, unknown> | undefined;
  const isAdmin = sessionUser?.id === "bb-jmershon";
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:relative z-40 w-72 bg-gray-900 text-white flex flex-col h-full transition-transform duration-200`}
      >
        {/* Sidebar header */}
        <div className="p-4">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <span className="text-lg">&#x1F368;</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold">Scoop</h1>
              <p className="text-[10px] text-gray-400">Blue Bell AI</p>
            </div>
          </div>
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2.5 text-sm hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 scrollbar-thin">
          <ConversationSidebar
            currentId={conversationId}
            onSelect={handleSelectConversation}
            onNew={handleNewChat}
            onDelete={handleDeleteConversation}
          />
        </div>

        {/* Sidebar footer */}
        <div className="p-4 border-t border-gray-800">
          {isAdmin && (
            <a
              href="/admin"
              className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Admin
            </a>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-800 rounded-full flex items-center justify-center text-xs font-medium">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.name || "User"}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.email || ""}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="p-1 rounded hover:bg-gray-800 transition-colors"
              title="Sign out"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <main className="flex-1 flex flex-col h-screen bg-gray-50 min-w-0">
        <header className="border-b border-gray-200 bg-white px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-sm font-medium text-gray-800">
              {messages.length === 0 ? "New chat" : "Chat"}
            </h2>
          </div>
        </header>

        <ChatThread messages={messages} isStreaming={isStreaming} onSuggestion={handleSend} />
        <ChatInput onSend={handleSend} onStop={stopStreaming} isStreaming={isStreaming} />
      </main>
    </div>
  );
}
