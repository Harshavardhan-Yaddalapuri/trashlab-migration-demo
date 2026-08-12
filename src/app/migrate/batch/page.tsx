"use client";

import { Suspense } from "react";
import { FullBatchView } from "@/components/demo/full-batch-view";

export default function BatchPage() {
  return (
    <Suspense fallback={null}>
      <FullBatchView />
    </Suspense>
  );
}
