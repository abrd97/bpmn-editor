import EventBus from "diagram-js/lib/core/EventBus";
import CommandStack from "diagram-js/lib/command/CommandStack";
import { MessageType } from "./websocket-service";
import { ICollaborationService } from "./collaboration-service-base";

interface CommandPayload {
  command: string;
  context: Record<string, unknown>;
}

interface LockPayload {
  elementId: string;
}

export class OutboundBpmnService implements ICollaborationService {
  static $inject = ["eventBus", "commandStack"];

  private sendMessage: ((type: MessageType, payload: unknown) => void) | null = null;
  private currentEditingElement: string | null = null;
  private commandStackExecutedListener: ((e: unknown) => void) | null = null;
  private commandStackRevertedListener: ((e: unknown) => void) | null = null;
  private commandStackChangedListener: (() => void) | null = null;
  private selectionListener: ((e: unknown) => void) | null = null;

  constructor(
    private eventBus: EventBus,
    private commandStack: CommandStack,
  ) {
    this._setupCommandTracking();
    this._setupElementSelectionTracking();
  }

  public destroy() {
    if (this.commandStackExecutedListener) {
      this.eventBus.off("commandStack.executed", this.commandStackExecutedListener);
      this.commandStackExecutedListener = null;
    }
    if (this.commandStackRevertedListener) {
      this.eventBus.off("commandStack.reverted", this.commandStackRevertedListener);
      this.commandStackRevertedListener = null;
    }
    if (this.commandStackChangedListener) {
      this.eventBus.off("commandStack.changed", this.commandStackChangedListener);
      this.commandStackChangedListener = null;
    }
    if (this.selectionListener) {
      this.eventBus.off("selection.changed", this.selectionListener);
      this.selectionListener = null;
    }
  }

  /**
   * Set the send message function from collaboration context
   */
  public setSendMessage(fn: (type: MessageType, payload: unknown) => void) {
    this.sendMessage = fn;
  }

  private _setupCommandTracking() {
    // Listen to executed event for new commands (most common case)
    // This event provides command and context directly in the payload
    // According to CommandStack docs: event object contains 'command' and 'context'
    this.commandStackExecutedListener = (event: unknown) => {
      try {
        const e = event as { command?: string; context?: Record<string, unknown> };
        if (!e.command || !e.context) return;

        // Skip remote commands to prevent feedback loop
        if ((e.context as { isRemote?: boolean })?.isRemote) return;

        const payload: CommandPayload = {
          command: e.command,
          context: this._extractContextData(e.context),
        };

        this._broadcast("command", payload);
      } catch (error) {
        console.error("[Outbound] Error tracking executed command:", error);
      }
    };

    // Also listen to reverted event for undo operations
    this.commandStackRevertedListener = (event: unknown) => {
      try {
        const e = event as { command?: string; context?: Record<string, unknown> };
        if (!e.command || !e.context) return;

        // Skip remote commands
        if ((e.context as { isRemote?: boolean })?.isRemote) return;

        // For undo, we need to send the inverse command
        // Note: This is a simplified approach - proper undo would require
        // tracking the inverse operation, which is complex
        const payload: CommandPayload = {
          command: e.command,
          context: this._extractContextData(e.context),
        };

        this._broadcast("command", payload);
      } catch (error) {
        console.error("[Outbound] Error tracking reverted command:", error);
      }
    };

    // Fallback: Listen to generic changed event for other operations (clear, etc.)
    // This requires accessing internals, but only as a fallback
    this.commandStackChangedListener = () => {
      try {
        // Only use this if executed/reverted events don't provide enough info
        // Access command stack internals (fragile but necessary as fallback)
        const commandStackInternal = this.commandStack as unknown as {
          _stack?: Array<{ command: string; context: Record<string, unknown> }>;
          _stackIdx?: number;
        };

        const undoStack = commandStackInternal._stack;
        const stackIdx = commandStackInternal._stackIdx;

        if (!undoStack || stackIdx === undefined || stackIdx < 0) return;

        const action = undoStack[stackIdx];
        if (!action || (action.context as { isRemote?: boolean })?.isRemote) return;

        // Only broadcast if this wasn't already handled by executed/reverted events
        // (This is a safety net for edge cases)
        const payload: CommandPayload = {
          command: action.command,
          context: this._extractContextData(action.context),
        };

        this._broadcast("command", payload);
      } catch (error) {
        console.error("[Outbound] Error tracking command (fallback):", error);
      }
    };

    this.eventBus.on("commandStack.executed", this.commandStackExecutedListener);
    this.eventBus.on("commandStack.reverted", this.commandStackRevertedListener);
    this.eventBus.on("commandStack.changed", this.commandStackChangedListener);
  }

  /**
   * Extract only essential data from context, avoiding full object references
   * This prevents circular reference issues and reduces payload size
   */
  private _extractContextData(context: Record<string, unknown>): Record<string, unknown> {
    const extracted: Record<string, unknown> = {};

    // Extract IDs from objects (avoid sending full objects)
    if (context.shape) {
      const shape = context.shape as { id?: string };
      if (shape.id) extracted.shapeId = shape.id;
    }

    if (context.elements) {
      const elements = context.elements as Array<{ id?: string } | string>;
      extracted.elementIds = elements.map((el) => {
        if (typeof el === "string") return el;
        return el.id || "";
      });
    }

    if (context.element) {
      const element = context.element as { id?: string };
      if (element.id) extracted.elementId = element.id;
    }

    if (context.newShape) {
      const newShape = context.newShape as { id?: string };
      if (newShape.id) extracted.newShapeId = newShape.id;
    }

    if (context.connection) {
      const connection = context.connection as { id?: string };
      if (connection.id) extracted.connectionId = connection.id;
    }

    // Copy primitive values and simple objects directly
    const simpleKeys = ["delta", "newParent", "properties", "newBounds", "newWaypoints", "source", "target"];
    for (const key of simpleKeys) {
      if (key in context) {
        extracted[key] = context[key];
      }
    }

    return extracted;
  }

  private _setupElementSelectionTracking() {
    this.selectionListener = (e: unknown) => {
      const event = e as { newSelection?: Array<{ id?: string }> };
      const newSelection = event.newSelection || [];
      const selectedElement = newSelection.length > 0 ? newSelection[0] : null;
      const selectedElementId = selectedElement?.id || null;

      // Only broadcast if selection actually changed
      if (selectedElementId !== this.currentEditingElement) {
        // Unlock previous element
        if (this.currentEditingElement) {
          this._broadcast("unlock", { elementId: this.currentEditingElement });
        }

        // Lock new element (or clear if nothing selected)
        this.currentEditingElement = selectedElementId;
        if (selectedElementId) {
          this._broadcast("lock", { elementId: selectedElementId });
        }
      }
    };

    this.eventBus.on("selection.changed", this.selectionListener);
  }

  private _broadcast(
    type: MessageType,
    data: CommandPayload | LockPayload
  ) {
    if (!this.sendMessage) {
      // Silently drop messages if sendMessage not set yet (during initialization)
      return;
    }

    try {
      this.sendMessage(type, data);
    } catch (error) {
      console.error("[Outbound] Error broadcasting message:", error, { type, data });
    }
  }
}
