"use client";

import { useDemoStore } from "@/components/demo/demo-store";
import { LandingPage } from "@/components/demo/landing-page";
import { FileDropView } from "@/components/demo/file-drop-view";
import { LiveSampleView } from "@/components/demo/live-sample-view";
import { FullBatchView } from "@/components/demo/full-batch-view";
import { ExceptionReviewView } from "@/components/demo/exception-review-view";
import { ReportView } from "@/components/demo/report-view";

export default function HomePage() {
  const phase = useDemoStore((s) => s.phase);

  switch (phase) {
    case "landing":
      return <LandingPage />;
    case "file-drop":
      return <FileDropView />;
    case "live-sample":
      return <LiveSampleView />;
    case "full-batch":
      return <FullBatchView />;
    case "exception-review":
      return <ExceptionReviewView />;
    case "report":
      return <ReportView />;
    default:
      return <LandingPage />;
  }
}