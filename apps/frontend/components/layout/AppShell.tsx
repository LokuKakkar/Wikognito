"use client";

import type { ReactNode } from "react";
import { AuthBar } from "../AuthBar";
import { DetectiveDesk } from "../desk/DetectiveDesk";

interface AppShellProps {
  children: ReactNode;
  variant?: "page" | "game";
}

export function AppShell({ children, variant = "page" }: AppShellProps) {
  return (
    <div className={`app-shell app-shell-${variant}`}>
      <DetectiveDesk variant={variant}>
        <AuthBar />
        {children}
      </DetectiveDesk>
    </div>
  );
}
