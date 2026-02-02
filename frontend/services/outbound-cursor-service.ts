import { throttle } from "lodash";
import Canvas from "diagram-js/lib/core/Canvas";
import { MessageType } from "./websocket-service";
import { ICollaborationService } from "./collaboration-service-base";

export class OutboundCursorService implements ICollaborationService {
  private sendMessage: ((type: MessageType, payload: unknown) => void) | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private canvas: Canvas | null = null;

  public setSendMessage(fn: (type: MessageType, payload: unknown) => void) {
    this.sendMessage = fn;
  }

  public setCanvas(canvas: Canvas | null) {
    this.canvas = canvas;
  }

  public startTracking() {
    if (this.mouseMoveHandler) {
      return;
    }

    this.mouseMoveHandler = throttle((e: MouseEvent) => {
      // Convert screen coordinates to canvas coordinates
      let x = e.clientX;
      let y = e.clientY;

      if (this.canvas) {
        try {
          const container = this.canvas.getContainer();
          if (container && typeof container.getBoundingClientRect === 'function') {
            const rect = container.getBoundingClientRect();
            if (rect) {
              // Get relative position within canvas container
              const relativeX = e.clientX - rect.left;
              const relativeY = e.clientY - rect.top;
            
            // Convert to canvas coordinates using viewbox
            const viewbox = this.canvas.viewbox();
            const scale = viewbox.scale || 1;
            
                // Canvas coordinates = (screen position / scale) + viewbox offset
                x = (relativeX / scale) + viewbox.x;
                y = (relativeY / scale) + viewbox.y;
            }
          }
          } catch {
            // Canvas not ready, fall back to screen coordinates
          }
      }

      const payload = { x, y };
      this._broadcast("cursor", payload);
    }, 50);

    window.addEventListener("mousemove", this.mouseMoveHandler);
  }

  public stopTracking() {
    if (this.mouseMoveHandler) {
      window.removeEventListener("mousemove", this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }
  }

  public destroy() {
    this.stopTracking();
    this.sendMessage = null;
  }

  private _broadcast(type: MessageType, data: Record<string, unknown>) {
    if (!this.sendMessage) {
      return;
    }

    try {
      this.sendMessage(type, data);
    } catch (error) {
      console.error("[OutboundCursor] Error broadcasting cursor position:", error);
    }
  }
}
