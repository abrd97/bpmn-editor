"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FolderOpen, Plus, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import BpmnModeler from "bpmn-js/lib/Modeler";

interface EditorToolbarProps {
  modelerRef: React.RefObject<BpmnModeler | null>;
}

export function EditorToolbar({ modelerRef }: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!modelerRef.current) {
      toast.error("Editor not ready");
      return;
    }

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      if (!xml) {
        toast.error("No diagram to save");
        return;
      }

      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "bpmn-diagram.bpmn";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("BPMN diagram saved");
    } catch (error) {
      console.error("Error saving BPMN:", error);
      toast.error("Failed to save BPMN diagram");
    }
  };

  const handleNewDiagram = async () => {
    if (!modelerRef.current) {
      toast.error("Editor not ready");
      return;
    }

    try {
      await modelerRef.current.createDiagram();
      localStorage.removeItem("bpmn");
      toast.success("New diagram created");
    } catch (error) {
      console.error("Error creating new diagram:", error);
      toast.error("Failed to create new diagram");
    }
  };

  const handleOpenFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".bpmn")) {
      toast.error("Only BPMN files are allowed!");
      e.target.value = "";
      return;
    }

    try {
      const xml = await file.text();
      if (!modelerRef.current) {
        toast.error("Editor not ready");
        return;
      }

      await modelerRef.current.importXML(xml);
      localStorage.setItem("bpmn", xml);
      toast.success("BPMN file loaded");
    } catch (error) {
      console.error("Error loading BPMN:", error);
      toast.error("Failed to load BPMN file");
    }

    e.target.value = "";
  };

  return (
    <div className="absolute bottom-20 left-4 z-10 flex gap-2">
      <div className="relative">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".bpmn"
          onChange={handleOpenFile}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="bg-gray-100 hover:bg-gray-200 border-gray-300 h-9 px-3"
            >
              <div className="flex items-center gap-1.5">
                <FolderOpen className="h-4 w-4 text-gray-700" />
                <div className="w-px h-4 bg-gray-300" />
                <Plus className="h-4 w-4 text-gray-700" />
                <ChevronDown className="h-3 w-3 text-gray-700" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                handleNewDiagram();
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Diagram
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                fileInputRef.current?.click();
              }}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Open File
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleSave}
        className="bg-gray-100 hover:bg-gray-200 border-gray-300 h-9 px-3"
      >
        <div className="flex items-center gap-1.5">
          <Download className="h-4 w-4 text-gray-700" />
          <span className="text-sm text-gray-700">Save</span>
        </div>
      </Button>
    </div>
  );
}
