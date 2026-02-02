import ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import CommandStack from "diagram-js/lib/command/CommandStack";

interface CommandContext {
  // Array IDs (from outbound service)
  elementIds?: string[];
  shapesIds?: string[];
  _arrayType?: 'shapes' | 'elements';
  
  // Singular IDs
  elementId?: string;
  shapeId?: string;
  connectionId?: string;
  newShapeId?: string;
  
  // Relationship IDs
  parentId?: string;
  newParentId?: string;
  oldParentId?: string;
  sourceId?: string;
  targetId?: string;
  newSourceId?: string;
  newTargetId?: string;
  newHostId?: string;
  
  // Primitive values and objects
  delta?: { x: number; y: number };
  position?: { x: number; y: number } | { x: number; y: number; width: number; height: number };
  newBounds?: { x: number; y: number; width: number; height: number };
  oldBounds?: { x: number; y: number; width: number; height: number };
  properties?: Record<string, unknown>;
  newWaypoints?: Array<{ x: number; y: number }>;
  hints?: Record<string, unknown>;
  newParentIndex?: number;
  oldParentIndex?: number;
  parentIndex?: number;
  dockingOrPoints?: unknown;
  minBounds?: { x: number; y: number; width: number; height: number };
  updates?: unknown; // For UpdateFlowNodeRefsHandler (computed updates)
  
  // Legacy fields (for backward compatibility)
  shape?: unknown;
  element?: { id: string };
  newParent?: unknown;
  newShape?: { id: string };
  connection?: { id: string };
  source?: unknown;
  target?: unknown;
  isRemote?: boolean;
}

export class InboundBpmnService {
  static $inject = ["elementRegistry", "commandStack"];

  constructor(
    private elementRegistry: ElementRegistry,
    private commandStack: CommandStack,
  ) {}

  /**
   * Called when the WebSocket receives a command message
   * CRITICAL: Reconstructs context from IDs to element objects before execution
   */
  public handleRemoteCommand(data: { command: string; context: CommandContext }) {
    const { command, context } = data;

    try {
      const reconstructedContext = this._reconstructContext(command, context);
      
      if (!this._validateContext(command, reconstructedContext)) {
        return;
      }

      this.commandStack.execute(command, reconstructedContext);
    } catch (error) {
      console.error(`[Inbound] Error handling command ${command}:`, error);
    }
  }

  private _validateContext(command: string, context: Record<string, unknown>): boolean {
    switch (command) {
      case 'shape.move':
        return !!context.shape;

      case 'elements.move':
        return Array.isArray(context.shapes) && context.shapes.length > 0 && !context.shapes.some((s: unknown) => !s);

      case 'connection.create':
        return !!(context.connection && context.source && context.target);

      case 'connection.reconnect':
        return !!context.connection;

      case 'shape.resize':
        return !!context.shape;

      case 'elements.delete':
        return Array.isArray(context.elements) && context.elements.length > 0;

      case 'shape.create':
      case 'element.create':
        return !context.parentId || !!context.parent;

      default:
        if (context.shapeId && !context.shape) return false;
        if (context.connectionId && !context.connection) return false;
        return true;
    }
  }

  /**
   * Reconstructs context from serialized IDs back to element objects
   */
  private _reconstructContext(command: string, context: CommandContext): Record<string, unknown> {
    const reconstructed: Record<string, unknown> = { isRemote: true };

    // Command-specific reconstruction based on handler source code analysis
    switch (command) {
      case 'elements.move':
        if (context.shapesIds && Array.isArray(context.shapesIds)) {
          reconstructed.shapes = this._getElementsFromIds(context.shapesIds);
        } else if (context.elementIds && Array.isArray(context.elementIds)) {
          reconstructed.shapes = this._getElementsFromIds(context.elementIds);
        }
        if (!reconstructed.shapes || (Array.isArray(reconstructed.shapes) && reconstructed.shapes.length === 0)) {
          reconstructed.shapes = [];
        }
        if (context.delta) reconstructed.delta = context.delta;
        if (context.newParentId) {
          reconstructed.newParent = this._getElementFromId(context.newParentId);
        }
        if (context.newHostId) {
          reconstructed.newHost = this._getElementFromId(context.newHostId);
        }
        reconstructed.hints = context.hints || {};
        break;

      case 'shape.move':
        if (context.shapeId) {
          reconstructed.shape = this._getElementFromId(context.shapeId);
        }
        if (context.delta) reconstructed.delta = context.delta;
        if (context.newParentId) {
          reconstructed.newParent = this._getElementFromId(context.newParentId);
        }
        if (context.newParentIndex !== undefined) {
          reconstructed.newParentIndex = context.newParentIndex;
        }
        reconstructed.hints = context.hints || {};
        break;

      case 'elements.delete':
        if (context.elementIds) {
          reconstructed.elements = this._getElementsFromIds(context.elementIds);
        }
        break;

      case 'shape.create':
      case 'element.create':
        if (context.newShapeId || context.shapeId) {
          const shapeId = context.newShapeId || context.shapeId;
          reconstructed.shape = this._getElementFromId(shapeId);
        }
        if (context.parentId) {
          reconstructed.parent = this._getElementFromId(context.parentId);
        }
        if (context.position) {
          reconstructed.position = context.position;
        } else if (context.newBounds) {
          reconstructed.position = context.newBounds;
        }
        if (context.parentIndex !== undefined) {
          reconstructed.parentIndex = context.parentIndex;
        }
        break;

      case 'connection.create':
        if (context.connectionId) {
          reconstructed.connection = this._getElementFromId(context.connectionId);
        }
        if (context.sourceId) {
          reconstructed.source = this._getElementFromId(context.sourceId);
        }
        if (context.targetId) {
          reconstructed.target = this._getElementFromId(context.targetId);
        }
        if (context.parentId) {
          reconstructed.parent = this._getElementFromId(context.parentId);
        }
        if (context.parentIndex !== undefined) {
          reconstructed.parentIndex = context.parentIndex;
        }
        if (context.hints) {
          reconstructed.hints = context.hints;
        }
        break;

      case 'connection.reconnect':
        if (context.connectionId) {
          reconstructed.connection = this._getElementFromId(context.connectionId);
        }
        if (context.newSourceId) {
          reconstructed.newSource = this._getElementFromId(context.newSourceId);
        }
        if (context.newTargetId) {
          reconstructed.newTarget = this._getElementFromId(context.newTargetId);
        }
        if (context.dockingOrPoints) {
          reconstructed.dockingOrPoints = context.dockingOrPoints;
        }
        if (context.newWaypoints) {
          reconstructed.newWaypoints = context.newWaypoints;
        }
        reconstructed.hints = context.hints || {};
        break;

      case 'shape.resize':
        if (context.shapeId) {
          reconstructed.shape = this._getElementFromId(context.shapeId);
        }
        if (context.newBounds) {
          reconstructed.newBounds = context.newBounds;
        }
        if (context.minBounds) {
          reconstructed.minBounds = context.minBounds;
        }
        reconstructed.hints = context.hints || {};
        break;

      case 'updateFlowNodeRefs':
      case 'lane.updateRefs':
        // These are automatically handled by UpdateFlowNodeRefsBehavior
        break;

      default:
        // Generic reconstruction for unknown commands
        this._genericReconstruct(reconstructed, context);
    }

    return reconstructed;
  }

  private _genericReconstruct(reconstructed: Record<string, unknown>, context: CommandContext) {
    if (context.elementIds) {
      const elements = this._getElementsFromIds(context.elementIds);
      reconstructed.elements = elements;
      reconstructed.shapes = elements;
    }
    if (context.shapesIds) {
      reconstructed.shapes = this._getElementsFromIds(context.shapesIds);
    }

    if (context.shapeId) {
      reconstructed.shape = this._getElementFromId(context.shapeId);
    }
    if (context.elementId) {
      reconstructed.element = this._getElementFromId(context.elementId);
    }
    if (context.connectionId) {
      reconstructed.connection = this._getElementFromId(context.connectionId);
    }

    if (context.parentId) {
      reconstructed.parent = this._getElementFromId(context.parentId);
    }
    if (context.newParentId) {
      reconstructed.newParent = this._getElementFromId(context.newParentId);
    }
    if (context.oldParentId) {
      reconstructed.oldParent = this._getElementFromId(context.oldParentId);
    }
    if (context.sourceId) {
      reconstructed.source = this._getElementFromId(context.sourceId);
    }
    if (context.targetId) {
      reconstructed.target = this._getElementFromId(context.targetId);
    }
    if (context.newSourceId) {
      reconstructed.newSource = this._getElementFromId(context.newSourceId);
    }
    if (context.newTargetId) {
      reconstructed.newTarget = this._getElementFromId(context.newTargetId);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { updates: _updates, ...restOfContext } = context as Record<string, unknown>;
    Object.assign(reconstructed, restOfContext);
  }

  private _getElementFromId(id: string | undefined | null) {
    if (!id) return null;
    return this.elementRegistry.get(id) || null;
  }

  private _getElementsFromIds(ids: string[] | undefined): unknown[] {
    if (!ids || !Array.isArray(ids)) return [];
    return ids
      .map(id => this.elementRegistry.get(id))
      .filter((el): el is NonNullable<typeof el> => el != null);
  }


}
