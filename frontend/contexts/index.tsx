"use client";

import React from "react";
import { CollaborationProvider } from "./collaboration-context";
import { Toaster } from "@/components/ui/sonner";

/**
 * AppProvider - Combines all application-level providers
 * This should be used in the root layout to wrap the entire app
 */
export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <CollaborationProvider>
      {children}
      <Toaster
        position="bottom-right"
        closeButton
      />
    </CollaborationProvider>
  );
}

// Re-export collaboration context exports
export { CollaborationProvider, useCollaboration, type User, type LockedElement } from "./collaboration-context";