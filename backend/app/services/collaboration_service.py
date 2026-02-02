from typing import Dict, Set, Optional
from uuid import UUID
from fastapi import WebSocket
from app.models.message import CollaborationMessage
from app.models.user import User
from app.services.session_service import session_service
from app.repositories import user_repository
import random


class CollaborationService:
    """Service for managing WebSocket collaboration"""
    
    USER_COLORS = [
        "#3b82f6",  # blue
        "#ef4444",  # red
        "#10b981",  # green
        "#f59e0b",  # amber
        "#8b5cf6",  # purple
        "#ec4899",  # pink
        "#06b6d4",  # cyan
        "#f97316",  # orange
    ]
    
    def __init__(
        self,
        session_service_instance=None,
        user_repository_instance=None
    ):
        self._session_service = session_service_instance or session_service
        self._user_repository = user_repository_instance or user_repository
        self._connections: Dict[UUID, Set[WebSocket]] = {}
        self._websocket_info: Dict[WebSocket, tuple[UUID, str]] = {}
    
    def get_or_create_user(self, user_id: Optional[str] = None) -> User:
        """Get existing user by ID or create a new one"""
        if user_id:
            existing_user = self._user_repository.get(user_id)
            if existing_user:
                return existing_user
        
        nouns = ["Fox", "Eagle", "Lion", "Wolf", "Hawk", "Bear", "Tiger", "Panther"]
        name = f"{random.choice(nouns)}"
        color = random.choice(self.USER_COLORS)
        
        user = User(name=name, color=color)
        self._user_repository.create(user)
        return user
    
    async def connect(self, websocket: WebSocket, session_id: UUID, user: User) -> None:
        """Connect a user to a session"""
        await websocket.accept()
        
        if session_id not in self._connections:
            self._connections[session_id] = set[WebSocket]()
        self._connections[session_id].add(websocket)
        self._websocket_info[websocket] = (session_id, user.id)
        
        self._session_service.add_user(session_id, user.id)
        
        join_message = CollaborationMessage(
            type="join",
            userId=user.id,
            sessionId=str(session_id),
            payload={"user": user.model_dump()}
        )
        await self._broadcast_to_session(session_id, join_message, exclude_user_id=user.id)
        
        session = self._session_service.get_session(session_id)
        if session and session.bpmn_xml:
            sync_message = CollaborationMessage(
                type="sync",
                userId="system",
                sessionId=str(session_id),
                payload={"xml": session.bpmn_xml}
            )
            await self._send_to_websocket(websocket, sync_message)
    
    async def disconnect(self, websocket: WebSocket) -> None:
        """Disconnect a user from a session"""
        if websocket not in self._websocket_info:
            return
        
        session_id, user_id = self._websocket_info[websocket]
        
        if session_id in self._connections:
            self._connections[session_id].discard(websocket)
            if not self._connections[session_id]:
                del self._connections[session_id]
        
        del self._websocket_info[websocket]
        leave_message = CollaborationMessage(
            type="leave",
            userId=user_id,
            sessionId=str(session_id),
            payload={}
        )
        await self._broadcast_to_session(session_id, leave_message)
    
    async def handle_message(self, websocket: WebSocket, message: CollaborationMessage) -> None:
        """Handle incoming WebSocket message"""
        if websocket not in self._websocket_info:
            return
        
        session_id, user_id = self._websocket_info[websocket]
        
        message.sessionId = str(session_id)
        message.userId = user_id
        
        if message.type == "sync":
            payload = message.payload
            if isinstance(payload, dict) and "xml" in payload:
                self._session_service.update_bpmn_xml(session_id, payload["xml"])
        
        exclude_user = user_id if message.type in ["command", "cursor", "lock", "unlock"] else None
        await self._broadcast_to_session(session_id, message, exclude_user_id=exclude_user)
    
    async def _broadcast_to_session(
        self,
        session_id: UUID,
        message: CollaborationMessage,
        exclude_user_id: Optional[str] = None
    ) -> None:
        """Broadcast message to all clients in a session"""
        if session_id not in self._connections:
            return
        
        disconnected = set[WebSocket]()
        for websocket in self._connections[session_id]:
            if exclude_user_id and websocket in self._websocket_info:
                _, ws_user_id = self._websocket_info[websocket]
                if ws_user_id == exclude_user_id:
                    continue
            
            try:
                await self._send_to_websocket(websocket, message)
            except Exception:
                disconnected.add(websocket)
        
        for ws in disconnected:
            await self.disconnect(ws)
    
    async def _send_to_websocket(self, websocket: WebSocket, message: CollaborationMessage) -> None:
        """Send message to a specific WebSocket"""
        await websocket.send_text(message.model_dump_json())


collaboration_service = CollaborationService()
