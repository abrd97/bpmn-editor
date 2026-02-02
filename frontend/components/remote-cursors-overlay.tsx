"use client";

import { useEffect, useRef } from "react";
import { useCollaboration } from "@/contexts/collaboration-context";
import Canvas from "diagram-js/lib/core/Canvas";

interface RemoteCursorsOverlayProps {
  canvas: Canvas | null;
}

export function RemoteCursorsOverlay({ canvas }: RemoteCursorsOverlayProps) {
  const { remoteUsers } = useCollaboration();
  const overlayContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create a fixed overlay container that covers the entire viewport
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.pointerEvents = "none";
    container.style.zIndex = "9999";
    container.className = "remote-cursors-container";
    document.body.appendChild(container);
    overlayContainerRef.current = container;

    const updateCursors = () => {
      if (!overlayContainerRef.current) return;

      // Remove existing cursor overlays
      const existingCursors = overlayContainerRef.current.querySelectorAll(".remote-cursor-overlay");
      existingCursors.forEach((el) => el.remove());

      // Add cursor indicators for each remote user with cursor data
      remoteUsers.forEach((user) => {
        if (!user.cursor) return;
        
        // Convert canvas coordinates to screen coordinates
        let screenX = user.cursor.x;
        let screenY = user.cursor.y;
        
        if (canvas) {
          try {
            const container = canvas.getContainer();
            if (container && typeof container.getBoundingClientRect === 'function') {
              const rect = container.getBoundingClientRect();
              if (rect) {
                const viewbox = canvas.viewbox();
                const scale = viewbox.scale || 1;
                
                // Convert canvas coordinates to screen coordinates
                // screen = (canvas - viewbox.offset) * scale + container.offset
                screenX = rect.left + (user.cursor.x - viewbox.x) * scale;
                screenY = rect.top + (user.cursor.y - viewbox.y) * scale;
              }
            }
          } catch {
            // Canvas not ready, fall back to using coordinates as-is
          }
        }

        const cursorElement = document.createElement("div");
        cursorElement.className = "remote-cursor-overlay";
        cursorElement.style.position = "absolute";
        cursorElement.style.left = `${screenX}px`;
        cursorElement.style.top = `${screenY}px`;
        cursorElement.style.pointerEvents = "none";
        cursorElement.style.transform = "translate(-10px, -10px)";
        cursorElement.style.transition = "opacity 0.2s ease";

        // Cursor pointer (circular indicator)
        const pointer = document.createElement("div");
        pointer.style.width = "20px";
        pointer.style.height = "20px";
        pointer.style.border = `2px solid ${user.color}`;
        pointer.style.borderRadius = "50%";
        pointer.style.backgroundColor = `${user.color}40`;
        pointer.style.boxShadow = `0 0 8px ${user.color}80, 0 0 4px ${user.color}60`;
        pointer.style.position = "relative";

        // User label
        const label = document.createElement("div");
        label.style.position = "absolute";
        label.style.top = "-28px";
        label.style.left = "50%";
        label.style.transform = "translateX(-50%)";
        label.style.padding = "3px 8px";
        label.style.backgroundColor = user.color;
        label.style.color = "white";
        label.style.fontSize = "11px";
        label.style.fontWeight = "600";
        label.style.borderRadius = "4px";
        label.style.whiteSpace = "nowrap";
        label.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
        label.style.fontFamily = "system-ui, -apple-system, sans-serif";
        label.textContent = user.name;

        cursorElement.appendChild(pointer);
        cursorElement.appendChild(label);
        overlayContainerRef.current?.appendChild(cursorElement);
      });
    };

    // Update cursors immediately and periodically
    updateCursors();
    const interval = setInterval(updateCursors, 50);

    // Also update cursors when canvas viewbox changes (zoom/pan)
    let viewboxChangeListener: (() => void) | null = null;
    if (canvas) {
      try {
        // Access eventBus via the canvas's internal structure
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eventBus = (canvas as any)._eventBus;
        if (eventBus) {
          viewboxChangeListener = () => {
            updateCursors();
          };
          eventBus.on('canvas.viewbox.changed', viewboxChangeListener);
        }
      } catch {
        // Ignore viewbox listener errors
      }
    }

    return () => {
      clearInterval(interval);
      if (viewboxChangeListener && canvas) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const eventBus = (canvas as any)._eventBus;
          if (eventBus) {
            eventBus.off('canvas.viewbox.changed', viewboxChangeListener);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
      // Clean up container on unmount
      if (overlayContainerRef.current && overlayContainerRef.current.parentNode) {
        overlayContainerRef.current.parentNode.removeChild(overlayContainerRef.current);
      }
    };
  }, [remoteUsers, canvas]);

  return null;
}
