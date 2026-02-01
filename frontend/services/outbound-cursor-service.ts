import { throttle } from "lodash";
import { MessageType } from "./websocket-service";
import { ICollaborationService } from "./collaboration-service-base";

interface CursorPayload {
  x: number;
  y: number;
}

export class OutboundCursorService implements ICollaborationService {
  private sendMessage: ((type: MessageType, payload: unknown) => void) | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;

  public setSendMessage(fn: (type: MessageType, payload: unknown) => void) {
    this.sendMessage = fn;
  }

  public startTracking() {
    if (this.mouseMoveHandler) {
      return;
    }

    this.mouseMoveHandler = throttle((e: MouseEvent) => {
      const payload: CursorPayload = { x: e.clientX, y: e.clientY };
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

  private _broadcast(type: MessageType, data: CursorPayload) {
    if (!this.sendMessage) {
      // Silently drop messages if sendMessage not set yet (during initialization)
      return;
    }

    try {
      this.sendMessage(type, data);
    } catch (error) {
      console.error("[OutboundCursor] Error broadcasting cursor position:", error);
    }
  }
}
