# TrashLab Migration Cockpit

**READ CONTEXT.md FIRST.** It explains WHY this project exists: it is a job-seeking demo
to get Harsha hired as Product Engineer at TrashLab. The audience is John Tan (CTO,
ex-Stripe). The four JD lines it must prove, the strategic thesis, the hard constraints
(no internal jargon on the customer-facing site, real numbers over fake, demo must never
break, production-grade stack, do not rebuild what TrashLab already owns).

Then read **FIX-GUIDE.md** for the current gap (frontend is scripted simulation, backend
exists but is not wired to the UI) and the 5-step fix plan.

## Quick facts

- Stack: Next.js 15 (App Router) + TypeScript strict + LangGraph + LangSmith + Drizzle/Postgres + Zustand
- Tests: 360 passing (`npx vitest run`). Build: `npm run build`. Lint: 0 errors.
- Deploy: Vercel, auto-deploy on push to `main`. Live: https://trashlab-migration-demo.vercel.app
- Sample data: `scripts/export-source-files.ts` writes the 4 legacy source files (150k rows) to `sample-data/`
- Env: `.env.local` (DATABASE_URL=Neon, LANGSMITH_API_KEY, VERCEL_TOKEN). Never commit secrets.
- Rules of the repo: money = integer cents, pipeline = deterministic/seeded, no em-dashes in user-facing text.
