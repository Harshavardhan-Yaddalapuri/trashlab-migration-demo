"use client";

/**
 * Landing page component. Shows the TrashLab FAQ quote as the problem,
 * then the "right AND fast" solution framing. Has a Start button that
 * kicks off the demo flow.
 *
 * No em-dashes in any user-facing text.
 */

import { useDemoStore } from "@/components/demo/demo-store";
import { config } from "@/lib/config";

const FAQ_QUOTE =
  "Implementation depends on the size of your operation. Larger fleets with multiple yards, recurring routes, and existing software take longer because clean data migration, training, and rollout matter more than going fast.";

export function LandingPage() {
  const startDemo = useDemoStore((s) => s.startDemo);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 px-6 py-3">
        <h1 className="text-sm font-semibold tracking-tight">
          TrashLab Migration Cockpit
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          v{config.app.version}
        </span>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="max-w-3xl text-center">
          {/* Problem: FAQ quote */}
          <div className="mb-12">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              The Problem
            </p>
            <blockquote className="border-l-2 border-amber-500/40 pl-6 text-left">
              <p className="text-lg leading-8 text-zinc-300">
                {FAQ_QUOTE}
              </p>
              <footer className="mt-3 font-mono text-xs text-zinc-600">
                TrashLab FAQ
              </footer>
            </blockquote>
          </div>

          {/* Solution framing */}
          <div className="mb-12">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-emerald-500">
              The Answer
            </p>
            <h2 className="text-4xl font-bold leading-tight tracking-tight">
              Right <span className="text-emerald-400">AND</span> Fast.
            </h2>
            <p className="mt-6 text-base leading-7 text-zinc-400">
              An agent fleet that cleans 150,000 records, trains your team, and gets you live in 2 days. Not &quot;fast and dirty.&quot; Not &quot;slow and careful.&quot; Both.
            </p>
          </div>

          {/* Stats teaser */}
          <div className="mb-12 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-800/60">
            <div className="bg-zinc-950 px-6 py-5">
              <p className="font-mono text-2xl font-bold tabular-nums text-emerald-400">
                99.2%
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                Auto-Mapped
              </p>
            </div>
            <div className="bg-zinc-950 px-6 py-5">
              <p className="font-mono text-2xl font-bold tabular-nums text-zinc-100">
                2 Days
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                To Go-Live
              </p>
            </div>
            <div className="bg-zinc-950 px-6 py-5">
              <p className="font-mono text-2xl font-bold tabular-nums text-zinc-100">
                0
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                Silent Errors
              </p>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={startDemo}
            className="group inline-flex items-center gap-3 rounded-lg bg-emerald-500 px-8 py-3.5 text-sm font-semibold text-zinc-950 transition-all hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Start the 90-Second Demo
            <span className="transition-transform group-hover:translate-x-1" aria-hidden>
              {"->"}
            </span>
          </button>

          {/* Fleet preview */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-2">
            {["Orchestrator", "Intake", "Normalizer", "Resolver", "Mapper", "Validator", "Trainer", "Eval"].map(
              (agent) => (
                <span
                  key={agent}
                  className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500"
                >
                  {agent}
                </span>
              ),
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 border-t border-zinc-800/60 px-6 py-3">
        <p className="text-center font-mono text-[10px] text-zinc-700">
          Summit Disposal Services / 4 yards / 45 trucks / 150,000 records
        </p>
      </footer>
    </div>
  );
}