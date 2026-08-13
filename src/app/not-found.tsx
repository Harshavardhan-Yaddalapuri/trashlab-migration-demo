import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <p className="text-lg font-semibold text-slate-800">We couldn&apos;t find that page.</p>
      <p className="mt-2 text-sm text-slate-500">It may have moved, or the link might be off.</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#312d97] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#5149d7]"
      >
        Back to home
      </Link>
    </div>
  );
}
