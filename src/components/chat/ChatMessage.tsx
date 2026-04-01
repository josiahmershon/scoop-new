"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  messageId?: string;
  initialFeedback?: "like" | "dislike" | null;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, messageId, initialFeedback, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(initialFeedback || null);

  const handleFeedback = async (rating: "like" | "dislike") => {
    if (!messageId) return;
    const newRating = feedback === rating ? null : rating;
    setFeedback(newRating);

    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, rating: newRating }),
      });
    } catch (e) {
      console.error("Failed to send feedback:", e);
      setFeedback(feedback); // revert on error
    }
  };

  return (
    <div className={`flex gap-3 mb-6 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
          isUser
            ? "bg-blue-900 text-white"
            : "bg-amber-100 text-amber-700 border border-amber-200"
        }`}
      >
        {isUser ? "You" : "S"}
      </div>

      {/* Message + feedback */}
      <div className={`max-w-[75%] ${isUser ? "" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-blue-900 text-white rounded-tr-sm"
              : "bg-white text-gray-900 border border-gray-200 shadow-sm rounded-tl-sm"
          }`}
        >
          {isUser ? (
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {content}
            </div>
          ) : (
            <div className="prose-chat break-words">
              {content ? (
                <ReactMarkdown>{content}</ReactMarkdown>
              ) : isStreaming ? (
                <div className="flex items-center gap-1.5 py-1">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              ) : null}
              {isStreaming && content && (
                <span className="inline-block w-0.5 h-4 bg-amber-500 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Feedback buttons — assistant messages only, not while streaming */}
        {!isUser && content && !isStreaming && (
          <div className="flex items-center gap-1 mt-1 ml-1">
            <button
              onClick={() => handleFeedback("like")}
              className={`p-1 rounded transition-colors ${
                feedback === "like"
                  ? "text-green-600"
                  : "text-gray-300 hover:text-gray-500"
              }`}
              title="Helpful"
            >
              <svg className="w-3.5 h-3.5" fill={feedback === "like" ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
              </svg>
            </button>
            <button
              onClick={() => handleFeedback("dislike")}
              className={`p-1 rounded transition-colors ${
                feedback === "dislike"
                  ? "text-red-500"
                  : "text-gray-300 hover:text-gray-500"
              }`}
              title="Not helpful"
            >
              <svg className="w-3.5 h-3.5" fill={feedback === "dislike" ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
