"use client";

/**
 * Landing page component. Shows the TrashLab FAQ quote as the problem,
 * then the "right AND fast" solution framing. Has a Start button that
 * kicks off the demo flow.
 *
 * Customer-facing: speaks in outcomes (live in 2 days, no re-keying,
 * nothing lost), NOT internal architecture (no agent names, no
 * auto-map jargon). The engineering proof lives in the GitHub repo,
 * which the founder reviews separately.
 *
 * Styled to match TrashLab's production design language:
 * Manrope, deep indigo #1a174f, cyan #10A6CC, emerald #10B981,
 * light theme with soft indigo tints, rounded cards, pill CTAs.
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
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      {/* Top bar — dark indigo like TrashLab's hero, with their logo */}
      <header className="flex shrink-0 items-center justify-between bg-[#1a174f] px-6 py-3">
        <div className="flex items-center gap-3">
          {/* TrashLab logo (white wordmark, designed for dark bg) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/trashlab-logo.svg"
            alt="TrashLab"
            className="h-6 w-auto"
          />
          <span className="text-sm font-semibold tracking-tight text-white/90">
            Migration Cockpit
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/50">
          v{config.app.version}
        </span>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="max-w-3xl text-center">
          {/* Problem: FAQ quote */}
          <div className="mb-12">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5149d7]">
              The Problem
            </p>
            <blockquote className="mx-auto max-w-2xl rounded-2xl border border-[#e0deff] bg-[#f7f7ff] px-8 py-6 text-left">
              <p className="text-lg leading-8 text-slate-700">
                {FAQ_QUOTE}
              </p>
              <footer className="mt-3 text-xs font-medium text-[#6260af]">
                TrashLab FAQ
              </footer>
            </blockquote>
          </div>

          {/* Solution framing */}
          <div className="mb-12">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#10a6cc]">
              The Answer
            </p>
            <h2 className="text-5xl font-extrabold leading-tight tracking-tight text-[#1a174f]">
              Right <span className="text-[#10a6cc]">AND</span> Fast.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-600">
              Move your entire operation to TrashLab without re-keying a single record. Your customers, containers, routes, and billing history come over clean. Your team is trained before day one. You are live in days, not weeks.
            </p>
          </div>

          {/* Outcomes — customer language, not internal metrics */}
          <div className="mb-12 grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[#e0deff] bg-[#f7f7ff] px-6 py-5">
              <p className="text-3xl font-extrabold tabular-nums text-[#10b981]">
                2 Days
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#6260af]">
                To Go-Live
              </p>
            </div>
            <div className="rounded-2xl border border-[#e0deff] bg-[#f7f7ff] px-6 py-5">
              <p className="text-3xl font-extrabold tabular-nums text-[#1a174f]">
                150k
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#6260af]">
                Records Moved Clean
              </p>
            </div>
            <div className="rounded-2xl border border-[#e0deff] bg-[#f7f7ff] px-6 py-5">
              <p className="text-3xl font-extrabold tabular-nums text-[#1a174f]">
                0
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#6260af]">
                Lost or Duplicated
              </p>
            </div>
          </div>

          {/* CTA — pill button, TrashLab indigo */}
          <button
            onClick={startDemo}
            className="group inline-flex items-center gap-3 rounded-full bg-[#312d97] px-10 py-4 text-sm font-semibold text-white transition-all hover:bg-[#5149d7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5149d7] focus-visible:ring-offset-2"
          >
            See It In Action
            <span className="transition-transform group-hover:translate-x-1" aria-hidden>
              {"->"}
            </span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 border-t border-[#e0deff] bg-[#f7f7ff] px-6 py-3">
        <p className="text-center text-xs text-[#6260af]">
          Summit Disposal Services / 4 yards / 45 trucks / 150,000 records
        </p>
      </footer>
    </div>
  );
}
