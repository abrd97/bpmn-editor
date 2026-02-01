import { useEffect } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { websocketService, CollaborationMessage } from "@/app/services/websocket-service";

const WS_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "ws://localhost:8000/ws";

export function useCollaborationWebSocket() {
  const { sendMessage: sendWsMessage, lastMessage, readyState } = useWebSocket(WS_URL, {
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
  });

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const isConnected = readyState === ReadyState.OPEN;

  useEffect(() => {
    websocketService.setConnectionStatus(isConnected);
  }, [isConnected]);

  useEffect(() => {
    if (lastMessage) {
      try {
        const message: CollaborationMessage = JSON.parse(lastMessage.data);
        websocketService.handleMessage(message);
      } catch (error) {
        console.error("[WebSocket] Failed to parse message:", error);
      }
    }
  }, [lastMessage]);

  const sendMessage = (message: CollaborationMessage) => {
    if (isConnected) {
      sendWsMessage(JSON.stringify(message));
    } else {
      console.warn("[WebSocket] Cannot send message - not connected");
    }
  };

  return {
    isConnected,
    connectionStatus,
    readyState,
    sendMessage,
  };
}
