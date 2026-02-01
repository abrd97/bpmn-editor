"use client";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import { useEffect, useRef, useState } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import GridModule from "diagram-js-grid";
import { toast } from "sonner";
import EventBus from "diagram-js/lib/core/EventBus";
import Canvas from "diagram-js/lib/core/Canvas";
import ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import {
  OutboundBpmnModule,
  InboundBpmnModule,
} from "@/modules";
import {
  OutboundBpmnService,
  InboundBpmnService,
  OutboundCursorService,
  ICollaborationService,
  websocketService,
  CollaborationMessage,
} from "@/services";
import { useCollaboration } from "@/contexts/collaboration-context";
import { LockedElementsOverlay } from "./locked-elements-overlay";

interface EditorProps {
  model: string | null;
}

export default function Editor({ model }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const cursorTrackingRef = useRef<OutboundCursorService | null>(null);
  const [eventBus, setEventBus] = useState<EventBus | null>(null);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [elementRegistry, setElementRegistry] = useState<ElementRegistry | null>(null);
  const { sendMessage, currentUser } = useCollaboration();

  useEffect(() => {
    if (!containerRef.current || modelerRef.current) return;

    modelerRef.current = new BpmnModeler({
      container: containerRef.current,
      additionalModules: [GridModule, OutboundBpmnModule, InboundBpmnModule],
    });

    const eventBus: EventBus = modelerRef.current.get("eventBus");
    const elementRegistry: ElementRegistry = modelerRef.current.get("elementRegistry");
    
    queueMicrotask(() => {
      setEventBus(eventBus);
      setElementRegistry(elementRegistry);
    });

    const setCanvasAfterInit = () => {
      queueMicrotask(() => {
        // Get canvas AFTER diagram is initialized
        const canvas: Canvas = modelerRef.current!.get("canvas");
        setCanvas(canvas);
      });
    };

    if (!model) {
      modelerRef.current.createDiagram()
        .then(setCanvasAfterInit)
        .catch((err) => {
          // Check if this is a canvas layers error (handled silently)
          const errorStr = err?.toString() || String(err || '');
          const errorMessage = err?.message || errorStr;
          const isCanvasLayerError = 
            errorStr.includes('_layers') || 
            errorStr.includes('root-0') ||
            errorMessage.includes('_layers') ||
            errorMessage.includes('root-0');
          
          if (!isCanvasLayerError) {
            console.error("Error creating new BPMN", err);
            toast.error("Error creating BPMN");
          }
        });
    } else {
      modelerRef.current.importXML(model)
        .then(setCanvasAfterInit)
        .catch((err) => {
          // Check if this is a canvas layers error (handled silently)
          const errorStr = err?.toString() || String(err || '');
          const errorMessage = err?.message || errorStr;
          const isCanvasLayerError = 
            errorStr.includes('_layers') || 
            errorStr.includes('root-0') ||
            errorMessage.includes('_layers') ||
            errorMessage.includes('root-0');
          
          if (!isCanvasLayerError) {
            console.error("Error loading XML", err);
            toast.error("Error loading XML");
          }
        });
    }

    return () => {
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, [model]);

  useEffect(() => {
    if (!modelerRef.current || !sendMessage || !currentUser) return;

    const outboundService = modelerRef.current.get("outboundBpmnService") as OutboundBpmnService | undefined;
    const inboundService = modelerRef.current.get("inboundBpmnService") as InboundBpmnService | undefined;

    const collaborationServices: ICollaborationService[] = [];

    if (outboundService) {
      collaborationServices.push(outboundService);
    }

    if (!cursorTrackingRef.current) {
      cursorTrackingRef.current = new OutboundCursorService();
      cursorTrackingRef.current.startTracking();
      collaborationServices.push(cursorTrackingRef.current);
    } else {
      collaborationServices.push(cursorTrackingRef.current);
    }

    collaborationServices.forEach((service) => {
      service.setSendMessage(sendMessage);
    });

    const unsubscribeCommand = websocketService.on("command", (message: CollaborationMessage) => {
      if (message.userId === currentUser.id) return; // Ignore own messages
      
      const payload = message.payload as { command: string; context: Record<string, unknown> };
      inboundService?.handleRemoteCommand(payload);
    });

    // Lock/unlock and cursor messages are handled by CollaborationContext
    // No need to forward them to inboundService as those methods are empty/redundant

    return () => {
      unsubscribeCommand();
      // Cursor tracking cleanup is handled in the modeler cleanup effect
    };
  }, [sendMessage, currentUser]);

  useEffect(() => {
    return () => {
      if (cursorTrackingRef.current) {
        cursorTrackingRef.current.destroy();
        cursorTrackingRef.current = null;
      }
    };
  }, []);

  return (
    <div className="h-screen relative" ref={containerRef}>
      {eventBus && canvas && elementRegistry && (
        <LockedElementsOverlay
          eventBus={eventBus}
          canvas={canvas}
          elementRegistry={elementRegistry}
        />
      )}
    </div>
  );
}
