"use client";

import React from "react";
import { Toaster } from "@/components/ui/sonner";

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        closeButton
      />
    </>
  );
}

// Re-export collaboration context exports
export { CollaborationProvider, useCollaboration, type User, type LockedElement } from "./collaboration-context";