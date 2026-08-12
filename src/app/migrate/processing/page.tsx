"use client";

import { Suspense } from "react";
import { ProcessingView } from "@/components/workspace/processing-view";

export default function ProcessingPage() {
  return (
    <Suspense fallback={null}>
      <ProcessingView />
    </Suspense>
  );
}
