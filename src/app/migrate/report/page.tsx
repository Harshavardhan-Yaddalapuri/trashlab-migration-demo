"use client";

import { Suspense } from "react";
import { ReportView } from "@/components/demo/report-view";

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportView />
    </Suspense>
  );
}
