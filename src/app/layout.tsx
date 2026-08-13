import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrashLab Migration Cockpit",
  description: "Move your operation into TrashLab clean and fast, with nothing lost or duplicated.",
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
