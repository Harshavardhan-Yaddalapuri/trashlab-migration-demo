"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
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
  );
}
