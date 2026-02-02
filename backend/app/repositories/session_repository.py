from typing import Optional
from uuid import UUID
from app.models.session import Session


class SessionRepository:
    """In-memory repository for BPMN editor sessions"""
    
    def __init__(self):
        self._sessions: dict[UUID, Session] = {}
    
    def create(self, session: Session) -> Session:
        """Create a new session"""
        self._sessions[session.id] = session
        return session
    
    def get(self, session_id: UUID) -> Optional[Session]:
        """Get session by ID"""
        return self._sessions.get(session_id)
    
    def get_by_id_string(self, session_id: str) -> Optional[Session]:
        """Get session by ID string"""
        try:
            uuid = UUID(session_id)
            return self.get(uuid)
        except ValueError:
            return None
    
    def update(self, session: Session) -> Session:
        """Update existing session"""
        if session.id not in self._sessions:
            raise ValueError(f"Session {session.id} not found")
        from datetime import datetime
        session.updated_at = datetime.now()
        self._sessions[session.id] = session
        return session
    
    def delete(self, session_id: UUID) -> bool:
        """Delete session by ID"""
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False
    
    def list_all(self) -> list[Session]:
        """List all sessions"""
        return list[Session](self._sessions.values())
    
    def add_user(self, session_id: UUID, user_id: str) -> Optional[Session]:
        """Add user to session"""
        session = self.get(session_id)
        if session:
            session.user_ids.add(user_id)
            return self.update(session)
        return None
    
    def remove_user(self, session_id: UUID, user_id: str) -> Optional[Session]:
        """Remove user from session"""
        session = self.get(session_id)
        if session:
            session.user_ids.discard(user_id)
            return self.update(session)
        return None
    
    def update_bpmn_xml(self, session_id: UUID, xml: str) -> Optional[Session]:
        """Update BPMN XML for a session"""
        session = self.get(session_id)
        if session:
            session.bpmn_xml = xml
            return self.update(session)
        return None


session_repository = SessionRepository()
