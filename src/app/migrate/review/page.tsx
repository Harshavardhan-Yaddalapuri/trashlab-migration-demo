"use client";

import { Suspense } from "react";
import { ExceptionReviewView } from "@/components/demo/exception-review-view";

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ExceptionReviewView />
    </Suspense>
  );
}
