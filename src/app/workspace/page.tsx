"use client";

import { Suspense } from "react";
import { WorkspaceView } from "@/components/workspace/workspace-view";

export default function WorkspacePage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceView />
    </Suspense>
  );
}
