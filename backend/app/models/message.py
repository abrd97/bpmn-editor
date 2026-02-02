from pydantic import BaseModel, Field
from typing import Literal, Optional, Dict, Any
from app.models.user import User


MessageType = Literal["command", "cursor", "join", "leave", "sync", "lock", "unlock"]


class CommandPayload(BaseModel):
    """Payload for command messages"""
    command: str = Field(..., description="Command name")
    context: Dict[str, Any] = Field(default_factory=dict, description="Command context data")


class CursorPayload(BaseModel):
    """Payload for cursor position messages"""
    x: float = Field(..., description="Cursor X coordinate")
    y: float = Field(..., description="Cursor Y coordinate")


class LockPayload(BaseModel):
    """Payload for lock/unlock messages"""
    elementId: str = Field(..., description="BPMN element ID being locked or unlocked")


class JoinPayload(BaseModel):
    """Payload for join messages"""
    user: Optional[User] = Field(default=None, description="User information")


class SyncPayload(BaseModel):
    """Payload for sync messages"""
    xml: str = Field(..., description="Complete BPMN diagram XML")


class CollaborationMessage(BaseModel):
    """WebSocket collaboration message"""
    type: MessageType = Field(..., description="Message type")
    userId: str = Field(..., description="User ID sending the message")
    sessionId: Optional[str] = Field(default=None, description="Session ID")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Message payload")
