"use client";

import { useState } from "react";
import { useCollaboration } from "@/contexts/collaboration-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";

export function OnlineUsers() {
  const { remoteUsers, isConnected, sessionId } = useCollaboration();
  const [copied, setCopied] = useState(false);

  const totalUsers = isConnected ? remoteUsers.size + 1 : 0;

  const copySessionLink = async () => {
    const sessionUrl = window.location.href;

    try {
      await navigator.clipboard.writeText(sessionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy session link:", err);
    }
  };

  return (
    <Card className="p-3 bg-white/90 backdrop-blur-sm border shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          <span className="text-sm font-medium text-gray-700">
            {totalUsers} {totalUsers === 1 ? "user" : "users"} online
          </span>
        </div>
        <div className="flex gap-1 ml-2">
          {Array.from(remoteUsers.values()).map((user) => (
            <Badge
              key={user.id}
              variant="secondary"
              className="text-xs"
              style={{ backgroundColor: `${user.color}20`, color: user.color }}
            >
              <div
                className="w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: user.color }}
              />
              {user.name}
            </Badge>
          ))}
        </div>
        {sessionId && (
          <Button
            variant="ghost"
            size="xs"
            onClick={copySessionLink}
            className="ml-2 h-6 px-2 text-xs"
          >
            {copied ? (
              <>
                <Check className="size-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-3" />
                Copy Link
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}
