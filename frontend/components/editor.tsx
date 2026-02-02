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
import { RemoteCursorsOverlay } from "./remote-cursors-overlay";
import { EditorToolbar } from "./editor-toolbar";

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
  const { sendMessage, currentUser, currentDiagramXml, setCurrentDiagramXml, isConnected } = useCollaboration();

  useEffect(() => {
    if (!containerRef.current || modelerRef.current) return;
    
    if (!containerRef.current.isConnected) {
      return;
    }

    try {
      modelerRef.current = new BpmnModeler({
        container: containerRef.current,
        additionalModules: [GridModule, OutboundBpmnModule, InboundBpmnModule],
      });
    } catch (error) {
      console.error("[Editor] Error initializing BpmnModeler:", error);
      return;
    }

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

    // Priority: sync XML > localStorage model > create new
    const xmlToLoad = currentDiagramXml || model;
    
    if (!xmlToLoad) {
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
      modelerRef.current.importXML(xmlToLoad)
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
  }, [model, currentDiagramXml]);

  // Sync complete model from backend
  useEffect(() => {
    if (!modelerRef.current || !currentDiagramXml) return;

    // Only update if the XML is different from what we have
    modelerRef.current.saveXML({ format: true })
      .then(({ xml }) => {
        if (xml && xml !== currentDiagramXml) {
          modelerRef.current!.importXML(currentDiagramXml)
            .catch((err) => {
              console.error("[Editor] Error importing sync XML:", err);
            });
        }
      })
      .catch(() => {
        // If saveXML fails, just import the sync XML
        modelerRef.current!.importXML(currentDiagramXml)
          .catch((err) => {
            console.error("[Editor] Error importing sync XML:", err);
          });
      });
  }, [currentDiagramXml]);

  // Sync loaded BPMN file to backend when connected
  useEffect(() => {
    if (!isConnected || !currentUser || !model || currentDiagramXml) return;
    
    // If we have a model from file but no synced XML from backend, sync it
    // This happens when user opens a file and joins a session
    if (model && model.trim()) {
      sendMessage("sync", { xml: model });
    }
  }, [isConnected, currentUser, model, currentDiagramXml, sendMessage]);


  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    if (!modelerRef.current || !sendMessage || !currentUserRef.current) return;

    const outboundService = modelerRef.current.get("outboundBpmnService") as OutboundBpmnService | undefined;
    const inboundService = modelerRef.current.get("inboundBpmnService") as InboundBpmnService | undefined;
    
    if (!inboundService || !outboundService) {
      return;
    }

    const collaborationServices: ICollaborationService[] = [];

    if (outboundService) {
      collaborationServices.push(outboundService);
      // Set up diagram XML export tracking
      outboundService.setDiagramXmlUpdater(
        (xml: string) => {
          setCurrentDiagramXml(xml);
          localStorage.setItem("bpmn", xml);
        },
        async () => {
          if (modelerRef.current) {
            const { xml } = await modelerRef.current.saveXML({ format: true });
            return xml;
          }
          return undefined;
        }
      );
    }

    if (!cursorTrackingRef.current) {
      cursorTrackingRef.current = new OutboundCursorService();
      collaborationServices.push(cursorTrackingRef.current);
    } else {
      collaborationServices.push(cursorTrackingRef.current);
    }

    // Set canvas on cursor service for coordinate conversion
    const currentCanvas = modelerRef.current?.get("canvas") as Canvas | undefined;
    if (currentCanvas && cursorTrackingRef.current) {
      cursorTrackingRef.current.setCanvas(currentCanvas);
    }

    collaborationServices.forEach((service) => {
      service.setSendMessage(sendMessage);
    });

    // Start cursor tracking after canvas is set
    if (cursorTrackingRef.current && currentCanvas) {
      cursorTrackingRef.current.startTracking();
    }

    // Use ref to avoid stale closure - handler doesn't need to be recreated when currentUser changes
    const unsubscribeCommand = websocketService.on("command", (message: CollaborationMessage) => {
      // Backend already filters out sender's own messages, but double-check with ref
      const currentUser = currentUserRef.current;
      if (currentUser && message.userId === currentUser.id) {
        return;
      }
      
      const payload = message.payload as { command: string; context: Record<string, unknown> };
      if (!payload.command || !payload.context) {
        return;
      }
      
      // Get inbound service fresh each time (in case modeler wasn't ready before)
      const currentInboundService = modelerRef.current?.get("inboundBpmnService") as InboundBpmnService | undefined;
      if (!currentInboundService) {
        return;
      }
      
      currentInboundService.handleRemoteCommand(payload);
    });

    return () => {
      unsubscribeCommand();
    };
  }, [sendMessage, setCurrentDiagramXml]);

  // Update cursor service when canvas changes
  useEffect(() => {
    if (cursorTrackingRef.current && canvas) {
      cursorTrackingRef.current.setCanvas(canvas);
      // Restart tracking to ensure it uses the new canvas
      cursorTrackingRef.current.stopTracking();
      cursorTrackingRef.current.startTracking();
    }
  }, [canvas]);

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
      <EditorToolbar modelerRef={modelerRef} />
      <RemoteCursorsOverlay canvas={canvas} />
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
