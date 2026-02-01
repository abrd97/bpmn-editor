"use client";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import { useEffect, useRef } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import GridModule from "diagram-js-grid";
import { toast } from "sonner";
import OutboundCollaborationModule from "@/app/modules/outbound-module";
import InboundCollaborationModule from "@/app/modules/inbound-module";


interface EditorProps {
  model: string | null;
}

export default function Editor({ model }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    modelerRef.current = new BpmnModeler({
      container: containerRef.current,
      additionalModules: [GridModule, OutboundCollaborationModule, InboundCollaborationModule],
    });

    if (!model) {
      modelerRef.current.createDiagram().catch((err) => {
        console.error("Error creating new BPMN", err);
        toast.error("Error creating BPMN");
      });
    } else {
      modelerRef.current.importXML(model).catch((err) => {
        console.error("Error loading XML", err);
        toast.error("Error loading XML");
      });
    }
  }, []);
  return <div className="h-screen" ref={containerRef}></div>;
}
