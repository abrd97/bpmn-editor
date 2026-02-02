"use client";

import { useEffect, useMemo } from "react";
import { useCollaboration } from "@/contexts/collaboration-context";
import EventBus from "diagram-js/lib/core/EventBus";
import Canvas from "diagram-js/lib/core/Canvas";
import ElementRegistry from "diagram-js/lib/core/ElementRegistry";

interface LockedElementsOverlayProps {
  eventBus: EventBus | null;
  canvas: Canvas | null;
  elementRegistry: ElementRegistry | null;
}

export function LockedElementsOverlay({
  eventBus,
  canvas,
  elementRegistry,
}: LockedElementsOverlayProps) {
  const { lockedElements } = useCollaboration();
  
  const lockedElementIds = useMemo(() => new Set(lockedElements.keys()), [lockedElements]);

  useEffect(() => {
    if (!eventBus || !canvas || !elementRegistry) return;

    const updateOverlays = () => {
      try {
        // Check if canvas layers are initialized (canvas._layers exists)
        // Canvas layers are only available after diagram is created/imported
        const canvasWithLayers = canvas as Canvas & { _layers?: Record<string, unknown> };
        if (!canvasWithLayers._layers) {
          return;
        }
        
        // Check if container is available (getContainer might throw if layers aren't ready)
        let container: HTMLElement | null = null;
        try {
          container = canvas.getContainer();
          // Additional check: ensure container is actually a DOM element
          if (!container || typeof container.getBoundingClientRect !== 'function') {
            return;
          }
        } catch {
          return;
        }
        
        if (!container) return;
        
        const containerElement = container;
        const existingOverlays = containerElement.querySelectorAll(".collaboration-lock-overlay");
        existingOverlays.forEach((el) => el.remove());

        // Add lock overlays for locked elements
        lockedElementIds.forEach((elementId) => {
          const lockInfo = lockedElements.get(elementId);
          if (!lockInfo) return;

          // Find the element in the canvas
          const element = elementRegistry.get(elementId);
          if (!element) return;

          // Get element bounding box (element has x, y, width, height)
          const bbox = element;
          const viewbox = canvas.viewbox();

          // Calculate screen coordinates
          const x = (bbox.x - viewbox.x) * viewbox.scale;
          const y = (bbox.y - viewbox.y) * viewbox.scale;
          const width = bbox.width * viewbox.scale;
          const height = bbox.height * viewbox.scale;

          // Create overlay element
          const overlay = document.createElement("div");
          overlay.className = "collaboration-lock-overlay";
          overlay.style.position = "absolute";
          overlay.style.left = `${x}px`;
          overlay.style.top = `${y}px`;
          overlay.style.width = `${width}px`;
          overlay.style.height = `${height}px`;
          overlay.style.pointerEvents = "none";
          overlay.style.zIndex = "1000";
          overlay.style.border = `2px solid ${lockInfo.userColor}`;
          overlay.style.borderRadius = "4px";
          overlay.style.backgroundColor = `${lockInfo.userColor}15`;
          overlay.style.boxShadow = `0 0 8px ${lockInfo.userColor}40`;

          // Add user label
          const label = document.createElement("div");
          label.style.position = "absolute";
          label.style.top = "-24px";
          label.style.left = "0";
          label.style.padding = "2px 6px";
          label.style.backgroundColor = lockInfo.userColor;
          label.style.color = "white";
          label.style.fontSize = "11px";
          label.style.fontWeight = "500";
          label.style.borderRadius = "3px";
          label.style.whiteSpace = "nowrap";
          label.textContent = `${lockInfo.userName}`;
          overlay.appendChild(label);

          containerElement.appendChild(overlay);
        });
      } catch {
        // Canvas not ready yet, skip overlay update
        return;
      }
    };

    // Update overlays when viewbox changes
    eventBus.on("canvas.viewbox.changed", updateOverlays);
    updateOverlays();

    return () => {
      eventBus.off("canvas.viewbox.changed", updateOverlays);
      try {
        const container = canvas?.getContainer();
        if (container && typeof container.querySelectorAll === 'function') {
          const overlays = container.querySelectorAll(".collaboration-lock-overlay");
          overlays.forEach((el) => el.remove());
        }
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [eventBus, canvas, elementRegistry, lockedElementIds, lockedElements]);

  return null;
}
