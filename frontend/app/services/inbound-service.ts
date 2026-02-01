import ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import EventBus from "diagram-js/lib/core/EventBus";
import Modeling from "bpmn-js/lib/features/modeling/Modeling";
import Canvas from "diagram-js/lib/core/Canvas";

export class InboundCollaborationService {
  static $inject = ["eventBus", "elementRegistry", "modeling", "canvas"];

  constructor(
    private eventBus: EventBus,
    private elementRegistry: ElementRegistry,
    private modeling: Modeling,
    private canvas: Canvas,
  ) {}

  /**
   * Called when the WebSocket receives a 'DIAGRAM_CHANGE'
   */
  public handleRemoteCommand(data: { command: string; context: any }) {
    const { command, context } = data;

    // 1. Find the local elements referenced by the IDs in the message
    const elements = context.elements
      ? context.elements.map((id: string) => this.elementRegistry.get(id))
      : [this.elementRegistry.get(context.shape.id)];

    // 2. Add a 'remote' flag to the context to prevent the Outbound
    // service from sending this change back to the server.
    const remoteContext = { ...context, elements, isRemote: true };

    // 3. Replay the command using the modeling service
    // Example: if command is 'shape.move'
    if (command === "shape.move") {
      this.modeling.moveElements(elements, context.delta, context.newParent);
    }

    // You can also use direct commandStack execution for generic commands:
    // this.commandStack.execute(command, remoteContext);
  }

  /**
   * Called when the WebSocket receives a 'MOUSE_MOVE'
   */
  public handleRemoteMouse(data: { userId: string; x: number; y: number }) {
    // Fire a local event so your UI cursor components can re-render
    this.eventBus.fire("collaboration.remoteMouseMove", data);
  }
}
