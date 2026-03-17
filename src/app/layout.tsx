import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scoop - Blue Bell AI Assistant",
  description: "Internal AI assistant for Blue Bell Creameries",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
