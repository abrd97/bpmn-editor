from typing import Dict, Set, Optional
from uuid import UUID
from fastapi import WebSocket
from app.models.message import CollaborationMessage
from app.models.user import User
from app.services.session_service import session_service
from app.repositories import user_repository
import random
import logging

logger = logging.getLogger(__name__)


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
    
    def generate_user(self) -> User:
        """Generate a new user with random name and color"""
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
        
        existing_users = []
        seen_user_ids = set[str]()
        
        for ws in self._connections[session_id]:
            if ws == websocket or ws not in self._websocket_info:
                continue
            
            _, existing_user_id = self._websocket_info[ws]
            if existing_user_id in seen_user_ids:
                continue
            
            existing_user = self._user_repository.get(existing_user_id)
            if not existing_user:
                continue
            
            seen_user_ids.add(existing_user_id)
            existing_users.append(existing_user.model_dump())
        
        join_message_to_user = CollaborationMessage(
            type="join",
            userId=user.id,
            sessionId=str(session_id),
            payload={
                "user": user.model_dump(),
                "existingUsers": existing_users
            }
        )
        await self._send_to_websocket(websocket, join_message_to_user)
        
        join_message = CollaborationMessage(
            type="join",
            userId=user.id,
            sessionId=str(session_id),
            payload={"user": user.model_dump()}
        )
        await self._broadcast_to_session(session_id, join_message, exclude_user_id=user.id)
        
        # Send current diagram state if available
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
        
        # Remove WebSocket connection
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
            logger.warning("[Backend] WebSocket not in _websocket_info")
            return
        
        session_id, user_id = self._websocket_info[websocket]
        
        if message.userId != user_id:
            logger.warning(f"[Backend] User ID mismatch: message.userId={message.userId}, expected={user_id}")
            return
        
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
            logger.warning(f"[Backend] Session {session_id} not in _connections")
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
