import ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import Modeling from "bpmn-js/lib/features/modeling/Modeling";
import CommandStack from "diagram-js/lib/command/CommandStack";

interface CommandContext {
  elementIds?: string[];
  elementId?: string;
  shapeId?: string;
  shape?: unknown;
  element?: { id: string };
  delta?: { x: number; y: number };
  newParent?: unknown;
  newShape?: { id: string };
  newShapeId?: string;
  properties?: Record<string, unknown>;
  newBounds?: { x: number; y: number; width: number; height: number };
  connection?: { id: string };
  connectionId?: string;
  source?: unknown;
  target?: unknown;
  newWaypoints?: Array<{ x: number; y: number }>;
  isRemote?: boolean;
}

export class InboundBpmnService {
  static $inject = ["elementRegistry", "modeling", "commandStack"];

  constructor(
    private elementRegistry: ElementRegistry,
    private modeling: Modeling,
    private commandStack: CommandStack,
  ) {}

  /**
   * Called when the WebSocket receives a command message
   */
  public handleRemoteCommand(data: { command: string; context: CommandContext }) {
    const { command, context } = data;

    try {
      // Mark context as remote to prevent feedback loop (only needed for commandStack.execute)
      const remoteContext = { ...context, isRemote: true };

      // Handle different command types
      switch (command) {
        case "shape.move":
          this._handleShapeMove(context);
          break;

        case "element.create":
          this._handleElementCreate(remoteContext);
          break;

        case "element.delete":
          this._handleElementDelete(context);
          break;

        case "element.updateProperties":
          this._handleUpdateProperties(context);
          break;

        case "shape.resize":
          this._handleShapeResize(context);
          break;

        case "connection.create":
          this._handleConnectionCreate(remoteContext);
          break;

        case "connection.delete":
          this._handleConnectionDelete(context);
          break;

        case "connection.reconnect":
          this._handleConnectionReconnect(remoteContext);
          break;

        default:
          // Try to execute command directly via commandStack
          try {
            this.commandStack.execute(command, remoteContext);
          } catch (err) {
            console.warn(`[Inbound] Unknown command: ${command}`, err);
          }
      }
    } catch (error) {
      console.error(`[Inbound] Error handling command ${command}:`, error);
    }
  }

  private _handleShapeMove(context: CommandContext) {
    const elementIds = context.elementIds || (context.shapeId ? [context.shapeId] : []);
    const elements = elementIds
      .map((id: string) => this.elementRegistry.get(id))
      .filter((el): el is NonNullable<typeof el> => el != null);

    if (elements.length > 0 && context.delta) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.modeling.moveElements(elements as any, context.delta, context.newParent as any);
    }
  }

  private _handleElementCreate(remoteContext: CommandContext) {
    // Element creation is complex and requires full context data
    // Use commandStack.execute() which handles all the necessary steps
    // remoteContext already has isRemote: true to prevent feedback loop
    if (remoteContext.shapeId || remoteContext.newShapeId) {
      try {
        this.commandStack.execute("element.create", remoteContext);
      } catch (err) {
        console.warn("[Inbound] Error creating element:", err);
      }
    }
  }

  private _handleElementDelete(context: CommandContext) {
    const elementIds = context.elementIds || (context.elementId ? [context.elementId] : []);
    const elements = elementIds
      .map((id: string) => this.elementRegistry.get(id))
      .filter((el): el is NonNullable<typeof el> => el != null);

    if (elements.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.modeling.removeElements(elements as any);
    }
  }

  private _handleUpdateProperties(context: CommandContext) {
    const element = context.elementId
      ? this.elementRegistry.get(context.elementId)
      : null;

    if (element && context.properties) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.modeling.updateProperties(element as any, context.properties);
    }
  }

  private _handleShapeResize(context: CommandContext) {
    const shape = context.shapeId ? this.elementRegistry.get(context.shapeId) : null;

    if (shape && context.newBounds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.modeling.resizeShape(shape as any, context.newBounds);
    }
  }

  private _handleConnectionCreate(remoteContext: CommandContext) {
    // Connection creation is complex, use commandStack
    // remoteContext already has isRemote: true to prevent feedback loop
    if (remoteContext.connection && remoteContext.source && remoteContext.target) {
      this.commandStack.execute("connection.create", remoteContext);
    }
  }

  private _handleConnectionDelete(context: CommandContext) {
    const connection = context.connectionId
      ? this.elementRegistry.get(context.connectionId)
      : null;

    if (connection) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.modeling.removeElements([connection] as any);
    }
  }

  private _handleConnectionReconnect(remoteContext: CommandContext) {
    // remoteContext already has isRemote: true to prevent feedback loop
    if (remoteContext.connection && remoteContext.newWaypoints) {
      this.commandStack.execute("connection.reconnect", remoteContext);
    }
  }

}
