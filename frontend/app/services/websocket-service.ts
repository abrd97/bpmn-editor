
export type MessageType = 'command' | 'cursor' | 'join' | 'leave' | 'sync' | 'lock' | 'unlock';

export interface CollaborationMessage {
  type: MessageType;
  userId: string;
  timestamp: number;
  payload: unknown;
}

export type MessageHandler = (message: CollaborationMessage) => void;

class WebSocketService {
  private handlers: Map<MessageType, Set<MessageHandler>> = new Map();
  private isConnected: boolean = false;

  setConnectionStatus(connected: boolean): void {
    this.isConnected = connected;
  }

  on(type: MessageType, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  handleMessage(message: CollaborationMessage): void {
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

}

export const websocketService = new WebSocketService();
