"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useDemoStore } from "@/components/demo/demo-store";
import { LandingPage } from "@/components/demo/landing-page";

/**
 * Root page. The URL is the single source of truth for the demo phase.
 * Each phase has its own route (see demo-store PHASE_TO_PATH); this
 * shell only renders the landing page at "/" and syncs the store
 * from the pathname so deep links and back/forward work.
 */
export default function HomePage() {
  const pathname = usePathname();
  const syncFromPath = useDemoStore((s) => s.syncFromPath);

  useEffect(() => {
    syncFromPath(pathname);
  }, [pathname, syncFromPath]);

  return <LandingPage />;
}
