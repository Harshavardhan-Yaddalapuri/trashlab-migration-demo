import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrashLab Migration Cockpit",
  description: "Agent fleet for clean, fast waste-management data migration",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
