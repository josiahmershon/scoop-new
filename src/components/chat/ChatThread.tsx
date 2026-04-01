"use client";

import { useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  feedback?: "like" | "dislike" | null;
}

interface ChatThreadProps {
  messages: Message[];
  isStreaming: boolean;
  onSuggestion?: (text: string) => void;
}

export function ChatThread({ messages, isStreaming, onSuggestion }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-5">
          <span className="text-3xl">&#x1F368;</span>
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Welcome to Scoop</h2>
        <p className="text-gray-500 text-center max-w-md mb-8">
          Your Blue Bell Creameries AI assistant. Ask me about IT issues, company procedures, or anything else.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
          {[
            { label: "Submit an IT ticket", icon: "&#x1F4CB;", message: "I need to submit an IT support ticket." },
            { label: "Look up a procedure", icon: "&#x1F4D6;", message: "Can you help me look up a company procedure?" },
            { label: "Help with APEX", icon: "&#x1F4BB;", message: "I need help with APEX." },
            { label: "UPC transition info", icon: "&#x1F4E6;", message: "What do I need to know about the UPC transition?" },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => onSuggestion?.(item.message)}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors text-left shadow-sm"
            >
              <span dangerouslySetInnerHTML={{ __html: item.icon }} />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
      <div className="max-w-3xl mx-auto">
        {messages.map((msg, i) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            messageId={msg.id}
            initialFeedback={msg.feedback}
            isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
