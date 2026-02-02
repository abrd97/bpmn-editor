from pydantic import BaseModel, Field
from typing import Literal, Optional, Dict, Any


MessageType = Literal["command", "cursor", "join", "leave", "sync", "lock", "unlock"]


class CollaborationMessage(BaseModel):
    """WebSocket collaboration message"""
    type: MessageType = Field(..., description="Message type")
    userId: str = Field(..., description="User ID sending the message")
    sessionId: Optional[str] = Field(default=None, description="Session ID")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Message payload")
