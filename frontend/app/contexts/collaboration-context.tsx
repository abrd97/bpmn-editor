"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { websocketService, CollaborationMessage, MessageType } from "../services/websocket-service";
import { useCollaborationWebSocket } from "@/hooks/use-collaboration-websocket";

export interface User {
  id: string;
  name: string;
  color: string;
}

export interface LockedElement {
  elementId: string;
  userId: string;
  userName: string;
  userColor: string;
}

interface CollaborationContextType {
  currentUser: User | null;
  onlineUsers: User[];
  lockedElements: Map<string, LockedElement>;
  sendMessage: (type: MessageType, payload: unknown) => void;
  isConnected: boolean;
}

const CollaborationContext = createContext<CollaborationContextType | undefined>(undefined);

export function useCollaboration() {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error("useCollaboration must be used within CollaborationProvider");
  }
  return context;
}

export function CollaborationProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [lockedElements, setLockedElements] = useState<Map<string, LockedElement>>(new Map());
  
  const { isConnected, sendMessage: wsSendMessage } = useCollaborationWebSocket();

  useEffect(() => {
    const handleJoin = (message: CollaborationMessage) => {
      const user = (message.payload as { user?: User }).user;
      if (!user) return;

      // If this is our own join (no currentUser set yet), set it
      if (!currentUser) {
        setCurrentUser(user);
        setOnlineUsers([user]);
        return;
      }

      // If it's another user joining, add them to onlineUsers
      if (message.userId !== currentUser.id) {
        setOnlineUsers((prev) => {
          const exists = prev.find((u) => u.id === message.userId);
          if (exists) return prev;
          return [...prev, user];
        });
      }
    };

    const handleLeave = (message: CollaborationMessage) => {
      setOnlineUsers((prev) => prev.filter((u) => u.id !== message.userId));
      // Remove locks from this user
      setLockedElements((prev) => {
        const next = new Map(prev);
        for (const [elementId, lock] of prev.entries()) {
          if (lock.userId === message.userId) {
            next.delete(elementId);
          }
        }
        return next;
      });
    };

    const handleLock = (message: CollaborationMessage) => {
      if (currentUser && message.userId === currentUser.id) return;
      
      setLockedElements((prev) => {
        const next = new Map(prev);
        const user = onlineUsers.find((u) => u.id === message.userId);
        if (user) {
          const payload = message.payload as { elementId?: string };
          if (payload.elementId) {
            next.set(payload.elementId, {
              elementId: payload.elementId,
              userId: message.userId,
              userName: user.name,
              userColor: user.color,
            });
          }
        }
        return next;
      });
    };

    const handleUnlock = (message: CollaborationMessage) => {
      setLockedElements((prev) => {
        const next = new Map(prev);
        const payload = message.payload as { elementId?: string };
        if (payload.elementId) {
          next.delete(payload.elementId);
        }
        return next;
      });
    };

    const unsubscribeJoin = websocketService.on("join", handleJoin);
    const unsubscribeLeave = websocketService.on("leave", handleLeave);
    const unsubscribeLock = websocketService.on("lock", handleLock);
    const unsubscribeUnlock = websocketService.on("unlock", handleUnlock);

    return () => {
      unsubscribeJoin();
      unsubscribeLeave();
      unsubscribeLock();
      unsubscribeUnlock();
    };
  }, [currentUser, onlineUsers]);

  const sendMessage = useCallback(
    (type: MessageType, payload: unknown) => {
      if (!currentUser || !wsSendMessage) return;

      wsSendMessage({
        type,
        userId: currentUser.id,
        timestamp: Date.now(),
        payload,
      });
    },
    [currentUser, wsSendMessage]
  );

  return (
    <CollaborationContext.Provider
      value={{
        currentUser,
        onlineUsers,
        lockedElements,
        sendMessage,
        isConnected,
      }}
    >
      {children}
    </CollaborationContext.Provider>
  );
}
