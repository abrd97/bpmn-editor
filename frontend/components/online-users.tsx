"use client";

import { useCollaboration } from "@/app/contexts/collaboration-context";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function OnlineUsers() {
  const { onlineUsers, isConnected } = useCollaboration();

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
            {onlineUsers.length} {onlineUsers.length === 1 ? "user" : "users"} online
          </span>
        </div>
        <div className="flex gap-1 ml-2">
          {onlineUsers.map((user) => (
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
      </div>
    </Card>
  );
}
