"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { websocketService, CollaborationMessage, MessageType } from "@/services";
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

export interface RemoteUser {
  id: string;
  name: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
    lastUpdate: number;
  };
}

interface CollaborationContextType {
  currentUser: User | null;
  remoteUsers: Map<string, RemoteUser>;
  lockedElements: Map<string, LockedElement>;
  sendMessage: (type: MessageType, payload: unknown) => void;
  isConnected: boolean;
  sessionId: string | null;
  currentDiagramXml: string | null;
  setCurrentDiagramXml: (xml: string | null) => void;
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlSessionId = searchParams.get("session");
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<Map<string, RemoteUser>>(new Map());
  const [lockedElements, setLockedElements] = useState<Map<string, LockedElement>>(new Map());
  const [currentDiagramXml, setCurrentDiagramXml] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(urlSessionId);
  const [hasReceivedJoin, setHasReceivedJoin] = useState(false);
  
  // Sync sessionId from URL when it changes (but only if we haven't received one from backend yet)
  useEffect(() => {
    if (urlSessionId && urlSessionId !== sessionId) {
      queueMicrotask(() => {
        setSessionId(urlSessionId);
      });
    }
  }, [urlSessionId, sessionId]);
  
  const { isConnected, sendMessage: wsSendMessage } = useCollaborationWebSocket(sessionId);

  // Clear join state when sessionId changes (new connection to different session)
  // Don't clear on disconnect/reconnect to same session to avoid reconnect loops
  useEffect(() => {
    queueMicrotask(() => {
      setHasReceivedJoin(false);
      setCurrentUser(null);
      setRemoteUsers(new Map());
    });
  }, [sessionId]);

  useEffect(() => {
    const handleJoin = (message: CollaborationMessage) => {
      const payload = message.payload as { user?: User; existingUsers?: User[] };
      let user = payload.user;
      if (!user) return;

      // Ensure user ID matches message.userId (use message.userId as source of truth)
      if (user.id !== message.userId) {
        user = { ...user, id: message.userId };
      }

      // Check if this is our own join message
      // If we have existingUsers in payload, this is our initial join
      // If we don't have currentUser OR message.userId matches currentUser, this is our join
      const isOurJoin = payload.existingUsers !== undefined || !currentUser || message.userId === currentUser.id;

      if (isOurJoin) {
        // This is our join - update currentUser with the user ID from backend
        setCurrentUser(user);
        setHasReceivedJoin(true);
        
        // Initialize remoteUsers with existing users (excluding self)
        const existingUsers = payload.existingUsers || [];
        const remoteUsersMap = new Map<string, RemoteUser>();
        for (const existingUser of existingUsers) {
          if (existingUser && existingUser.id !== user.id) {
            remoteUsersMap.set(existingUser.id, {
              id: existingUser.id,
              name: existingUser.name,
              color: existingUser.color,
            });
          }
        }
        setRemoteUsers(remoteUsersMap);
          
        // Always update sessionId from message if present
        if (message.sessionId) {
          setSessionId(message.sessionId);
          
          // Update URL with session ID if it's not already in URL
          if (!urlSessionId) {
            const url = new URL(window.location.href);
            url.searchParams.set("session", message.sessionId);
            router.replace(url.pathname + url.search, { scroll: false });
          }
        }
        return;
      }

      // If it's another user joining, add them to remoteUsers
      if (message.userId !== currentUser.id) {
        const newUser = user; // Type narrowing
        if (!newUser) return;
        
        setRemoteUsers((prev) => {
          if (prev.has(message.userId)) {
            return prev;
          }
          const next = new Map(prev);
          next.set(message.userId, {
            id: newUser.id,
            name: newUser.name,
            color: newUser.color,
          });
          return next;
        });
      }
    };

    const handleSync = (message: CollaborationMessage) => {
      // Backend sends current diagram state when user joins or on request
      const payload = message.payload as { xml?: string };
      if (payload.xml) {
        setCurrentDiagramXml(payload.xml);
      }
    };

    const handleLeave = (message: CollaborationMessage) => {
      // Remove user from remoteUsers
      setRemoteUsers((prev) => {
        const next = new Map(prev);
        next.delete(message.userId);
        return next;
      });
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
        const user = remoteUsers.get(message.userId);
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

    const handleCursor = (message: CollaborationMessage) => {
      if (currentUser && message.userId === currentUser.id) return; // Ignore own cursor
      
      const payload = message.payload as { x?: number; y?: number };
      if (payload.x === undefined || payload.y === undefined) return;

      setRemoteUsers((prev) => {
        const user = prev.get(message.userId);
        if (!user) return prev; // User not found, skip
        
        const next = new Map(prev);
        next.set(message.userId, {
          ...user,
          cursor: {
            x: payload.x!,
            y: payload.y!,
            lastUpdate: Date.now(),
          },
        });
        return next;
      });
    };

    const unsubscribeJoin = websocketService.on("join", handleJoin);
    const unsubscribeLeave = websocketService.on("leave", handleLeave);
    const unsubscribeLock = websocketService.on("lock", handleLock);
    const unsubscribeUnlock = websocketService.on("unlock", handleUnlock);
    const unsubscribeCursor = websocketService.on("cursor", handleCursor);
    const unsubscribeSync = websocketService.on("sync", handleSync);

    return () => {
      unsubscribeJoin();
      unsubscribeLeave();
      unsubscribeLock();
      unsubscribeUnlock();
      unsubscribeCursor();
      unsubscribeSync();
    };
  }, [currentUser, remoteUsers, urlSessionId, router, sessionId]);

  const sendMessage = useCallback(
    (type: MessageType, payload: unknown) => {
      // Only send if we have currentUser AND we've received join message for this connection
      if (!currentUser || !wsSendMessage || !hasReceivedJoin) return;

      wsSendMessage({
        type,
        userId: currentUser.id,
        sessionId: sessionId || undefined,
        payload,
      });
    },
    [currentUser, wsSendMessage, sessionId, hasReceivedJoin]
  );

  // Clean up stale cursors (no update in last 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRemoteUsers((prev) => {
        const next = new Map(prev);
        for (const [userId, user] of prev.entries()) {
          if (user.cursor && now - user.cursor.lastUpdate > 3000) {
            // Remove cursor but keep user
            next.set(userId, {
              ...user,
              cursor: undefined,
            });
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <CollaborationContext.Provider
      value={{
        currentUser,
        remoteUsers,
        lockedElements,
        sendMessage,
        isConnected,
        sessionId: sessionId || null,
        currentDiagramXml,
        setCurrentDiagramXml,
      }}
    >
      {children}
    </CollaborationContext.Provider>
  );
}
