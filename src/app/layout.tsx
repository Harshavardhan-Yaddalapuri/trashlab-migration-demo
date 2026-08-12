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
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
