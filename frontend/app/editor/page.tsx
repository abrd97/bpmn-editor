"use client";
import { useEffect, useState } from "react";
import Editor from "@/components/editor";

export default function EditorPage() {
  const [model, setModel] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const savedXml = localStorage.getItem("bpmn");
    setModel(savedXml);
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="h-screen w-full bg-slate-50" />; 
  }

  return <Editor model={model} />;
}