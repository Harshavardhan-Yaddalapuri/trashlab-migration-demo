"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <p className="text-lg font-semibold text-slate-800">Something went wrong.</p>
          <p className="mt-2 text-sm text-slate-500">
            This is on us, not something you did. You can try again.
          </p>
          <button
            onClick={reset}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#312d97] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#5149d7]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
