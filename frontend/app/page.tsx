"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".bpmn")) {
      toast.error("Only BPMN files are allowed!");
      e.target.value = "";
      return;
    }

    const xml = await file.text();
    localStorage.setItem("bpmn", xml);
    router.push("/editor");

    e.target.value = "";
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-start gap-8 py-20">
      <h1 className="font-bold text-4xl md:text-6xl tracking-tighter text-center">
        Create Your Own BPMN
      </h1>

      <div className="flex flex-row items-center justify-center gap-4">
        <Link href="/editor">
          <Button className="h-12 px-8 text-lg font-medium cursor-pointer">
            Create New
          </Button>
        </Link>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".bpmn"
          onChange={handleInput}
        />

        <Button
          variant="outline"
          className="h-12 px-8 text-lg font-medium cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          Open File
        </Button>
      </div>
    </div>
  );
}
