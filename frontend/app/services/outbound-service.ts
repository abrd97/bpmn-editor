import { throttle } from "lodash";
import EventBus from "diagram-js/lib/core/EventBus";

export class OutboundCollaborationService {
  static $inject = ["eventBus", "commandStack"];

  constructor(
    private eventBus: EventBus,
    private commandStack: any,
  ) {
    this._setupMouseTracking();
    this._setupCommandTracking();
  }

  private _setupMouseTracking() {
    const handleMove = throttle((e: MouseEvent) => {
      const payload = { x: e.clientX, y: e.clientY };

      this.eventBus.fire("collaboration.mouseMove", payload);
      this._broadcast("presence", payload);
    }, 50);

    window.addEventListener("mousemove", handleMove);
  }

  private _setupCommandTracking() {
    this.eventBus.on("commandStack.changed", () => {
      const action = this.commandStack._stack[this.commandStack._stackIdx];

      if (!action || action.context?.isRemote) return;

      const payload = {
        command: action.command,
        elements: action.context.elements,
        delta: action.context.delta,
      };

      this._broadcast("command", payload);
    });
  }

  private _broadcast(topic: "presence" | "command", data: any) {
    console.log(`[Outbound ${topic}]`, data);
  }
}
