export interface User {
  id: string;
  username: string; // sAMAccountName
  displayName: string;
  email: string;
  role: UserRole;
  groups: string[];
}

export type UserRole = "rsr" | "office_manager" | "sales_rep" | "it_admin" | "general";

export interface Conversation {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  feedback?: "like" | "dislike" | null;
}
