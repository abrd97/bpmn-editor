import EventBus from "diagram-js/lib/core/EventBus";
import CommandStack from "diagram-js/lib/command/CommandStack";
import { MessageType } from "./websocket-service";
import { ICollaborationService } from "./collaboration-service-base";

export class OutboundBpmnService implements ICollaborationService {
  static $inject = ["eventBus", "commandStack"];

  private sendMessage: ((type: MessageType, payload: unknown) => void) | null = null;
  private setDiagramXml: ((xml: string) => void) | null = null;
  private exportXml: (() => Promise<string | undefined>) | null = null;
  private currentEditingElement: string | null = null;
  private commandStackExecutedListener: ((e: unknown) => void) | null = null;
  private commandStackRevertedListener: ((e: unknown) => void) | null = null;
  private commandStackChangedListener: (() => void) | null = null;
  private selectionListener: ((e: unknown) => void) | null = null;
  private diagramExportListener: (() => void) | null = null;

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
    if (this.diagramExportListener) {
      this.eventBus.off("commandStack.changed", this.diagramExportListener);
      this.eventBus.off("diagram.init", this.diagramExportListener);
      this.diagramExportListener = null;
    }
  }

  /**
   * Set the send message function from collaboration context
   */
  public setSendMessage(fn: (type: MessageType, payload: unknown) => void) {
    this.sendMessage = fn;
  }

  /**
   * Set the diagram XML update function and export function from collaboration context
   * This will be called whenever the diagram changes to keep state in sync
   */
  public setDiagramXmlUpdater(
    setXmlFn: (xml: string) => void,
    exportXmlFn: () => Promise<string | undefined>
  ) {
    this.setDiagramXml = setXmlFn;
    this.exportXml = exportXmlFn;
    this._setupDiagramExportTracking();
  }

  private _setupCommandTracking() {
    // Listen to executed event for new commands (most common case)
    // This event provides command and context directly in the payload
    // According to CommandStack docs: event object contains 'command' and 'context'
    this.commandStackExecutedListener = (event: unknown) => {
      try {
        const e = event as { command?: string; context?: Record<string, unknown> };
        if (!e.command || !e.context) return;

        if ((e.context as { isRemote?: boolean })?.isRemote) return;

        if (e.command === 'lane.updateRefs' || e.command === 'updateFlowNodeRefs') {
          return;
        }

        const extractedContext = this._extractContextData(e.context);
        
        const contextKeys = Object.keys(extractedContext);
        if (contextKeys.length === 0 || (contextKeys.length === 1 && contextKeys[0] === 'isRemote')) {
          return;
        }

        const payload = {
          command: e.command,
          context: extractedContext,
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

        if ((e.context as { isRemote?: boolean })?.isRemote) return;

        if (e.command === 'lane.updateRefs' || e.command === 'updateFlowNodeRefs') {
          return;
        }

        const payload = {
          command: e.command,
          context: this._extractContextData(e.context),
        };

        this._broadcast("command", payload);
      } catch (error) {
        console.error("[Outbound] Error tracking reverted command:", error);
      }
    };

    this.commandStackChangedListener = () => {
      try {
        const commandStackInternal = this.commandStack as unknown as {
          _stack?: Array<{ command: string; context: Record<string, unknown> }>;
          _stackIdx?: number;
        };

        const undoStack = commandStackInternal._stack;
        const stackIdx = commandStackInternal._stackIdx;

        if (!undoStack || stackIdx === undefined || stackIdx < 0) return;

        const action = undoStack[stackIdx];
        if (!action || (action.context as { isRemote?: boolean })?.isRemote) return;

        if (action.command === 'lane.updateRefs' || action.command === 'updateFlowNodeRefs') {
          return;
        }

        const payload: Record<string, unknown> = {
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
   */
  private _extractContextData(context: Record<string, unknown>): Record<string, unknown> {
    const extracted: Record<string, unknown> = {};

    if (context.shapes && Array.isArray(context.shapes)) {
      extracted.shapesIds = this._extractElementIds(context.shapes);
      extracted._arrayType = 'shapes';
    }

    if (context.elements && Array.isArray(context.elements)) {
      extracted.elementIds = this._extractElementIds(context.elements);
      extracted._arrayType = 'elements';
    }

    // Extract singular element references
    if (context.shape && !Array.isArray(context.shape)) {
      extracted.shapeId = this._extractId(context.shape);
    }
    if (context.element && !Array.isArray(context.element)) {
      extracted.elementId = this._extractId(context.element);
    }
    if (context.connection) {
      extracted.connectionId = this._extractId(context.connection);
    }
    if (context.newShape) {
      extracted.newShapeId = this._extractId(context.newShape);
    }

    if (context.parent) {
      extracted.parentId = this._extractId(context.parent);
    }
    if (context.newParent) {
      extracted.newParentId = this._extractId(context.newParent);
    }
    if (context.oldParent) {
      extracted.oldParentId = this._extractId(context.oldParent);
    }
    if (context.newHost) {
      extracted.newHostId = this._extractId(context.newHost);
    }
    if (context.source) {
      extracted.sourceId = this._extractId(context.source);
    }
    if (context.target) {
      extracted.targetId = this._extractId(context.target);
    }
    if (context.newSource) {
      extracted.newSourceId = this._extractId(context.newSource);
    }
    if (context.newTarget) {
      extracted.newTargetId = this._extractId(context.newTarget);
    }

    const primitiveKeys = [
      'delta',
      'position',
      'newBounds',
      'oldBounds',
      'properties',
      'newWaypoints',
      'hints',
      'newParentIndex',
      'oldParentIndex',
      'parentIndex',
      'dockingOrPoints'
    ];
    for (const key of primitiveKeys) {
      if (key in context) {
        extracted[key] = context[key];
      }
    }

    return extracted;
  }

  private _extractId(obj: unknown): string | null {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'object' && obj !== null && 'id' in obj) {
      return (obj as { id: string }).id;
    }
    return null;
  }

  private _extractElementIds(elements: unknown[]): string[] {
    return elements
      .map(el => this._extractId(el))
      .filter((id): id is string => id !== null);
  }

  private _setupElementSelectionTracking() {
    this.selectionListener = (e: unknown) => {
      const event = e as { newSelection?: Array<{ id?: string }> };
      const newSelection = event.newSelection || [];
      const selectedElement = newSelection.length > 0 ? newSelection[0] : null;
      const selectedElementId = selectedElement?.id || null;

      if (selectedElementId !== this.currentEditingElement) {
        if (this.currentEditingElement) {
          this._broadcast("unlock", { elementId: this.currentEditingElement });
        }
        this.currentEditingElement = selectedElementId;
        if (selectedElementId) {
          this._broadcast("lock", { elementId: selectedElementId });
        }
      }
    };

    this.eventBus.on("selection.changed", this.selectionListener);
  }

  private _setupDiagramExportTracking() {
    if (this.diagramExportListener) {
      return;
    }

    let exportTimeout: NodeJS.Timeout | null = null;

    this.diagramExportListener = () => {
      if (exportTimeout) {
        clearTimeout(exportTimeout);
      }

      exportTimeout = setTimeout(() => {
        if (!this.setDiagramXml || !this.exportXml) return;

        const exportFn = this.exportXml;
        const setXmlFn = this.setDiagramXml;
        exportFn()
          .then((xml) => {
            if (xml && setXmlFn) {
              setXmlFn(xml);
            }
          })
          .catch((err) => {
            console.error("[Outbound] Error exporting diagram XML:", err);
          });
      }, 500);
    };

    this.eventBus.on("commandStack.changed", this.diagramExportListener);
    this.eventBus.on("diagram.init", this.diagramExportListener);
  }

  private _broadcast(type: MessageType, data: Record<string, unknown>) {
    if (!this.sendMessage) {
      return;
    }

    try {
      this.sendMessage(type, data);
    } catch (error) {
      console.error("[Outbound] Error broadcasting message:", error, { type, data });
    }
  }
}
