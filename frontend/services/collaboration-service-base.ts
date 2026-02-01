import { MessageType } from "./websocket-service";

export interface ICollaborationService {
  /**
   * Set the send message function from collaboration context.
   * This method is called when the WebSocket connection is established
   * and the collaboration context is ready to send messages.
   *
   * @param fn Function to send messages via WebSocket
   */
  setSendMessage(fn: (type: MessageType, payload: unknown) => void): void;

  /**
   * Cleanup method - should be called when service is destroyed.
   * Implementations should clean up event listeners, subscriptions, etc.
   */
  destroy?(): void;
}
