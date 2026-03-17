"use client";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-blue-900 text-white"
            : "bg-white text-gray-900 border border-gray-200 shadow-sm"
        }`}
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {content}
          {isStreaming && !content && (
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          )}
          {isStreaming && content && (
            <span className="inline-block w-1.5 h-4 bg-blue-500 ml-0.5 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
