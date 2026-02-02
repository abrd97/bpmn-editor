"use client";
import { useEffect, useState, Suspense } from "react";
import Editor from "@/components/editor";
import { OnlineUsers } from "@/components/online-users";
import { CollaborationProvider } from "@/contexts/collaboration-context";

function EditorPageContent() {
  const [model, setModel] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const savedXml = localStorage.getItem("bpmn");
    queueMicrotask(() => {
      setModel(savedXml);
      setIsMounted(true);
    });
  }, []);

  if (!isMounted) {
    return <div className="h-screen w-full bg-slate-50" />; 
  }

  return (
    <CollaborationProvider>
      <div className="relative h-screen">
        <div className="absolute top-4 right-4 z-10">
          <OnlineUsers />
        </div>
        <Editor model={model} />
      </div>
    </CollaborationProvider>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-slate-50" />}>
      <EditorPageContent />
    </Suspense>
  );
}