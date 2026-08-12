"use client";

import { Suspense } from "react";
import { LiveSampleView } from "@/components/demo/live-sample-view";

export default function LivePage() {
  return (
    <Suspense fallback={null}>
      <LiveSampleView />
    </Suspense>
  );
}
