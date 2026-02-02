from uuid import UUID
from typing import Optional
from app.models.session import Session
from app.repositories import session_repository


class SessionService:
    """Service for managing BPMN editor sessions"""
    
    def __init__(self, repository=None):
        self._repository = repository or session_repository
    
    def get_or_create_session(self, session_id: Optional[str] = None) -> Session:
        """Get existing session or create a new one"""
        if session_id:
            try:
                uuid = UUID(session_id)
                session = self._repository.get(uuid)
                if session:
                    return session
            except ValueError:
                pass
        
        new_session = Session()
        return self._repository.create(new_session)
    
    def get_session(self, session_id: UUID) -> Optional[Session]:
        """Get session by ID"""
        return self._repository.get(session_id)
    
    def update_bpmn_xml(self, session_id: UUID, xml: str) -> Optional[Session]:
        """Update BPMN XML for a session"""
        return self._repository.update_bpmn_xml(session_id, xml)


session_service = SessionService()
