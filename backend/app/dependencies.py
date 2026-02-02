from typing import Optional
from fastapi import Query, Cookie
from app.services import session_service, collaboration_service
from app.services.session_service import SessionService
from app.services.collaboration_service import CollaborationService


def get_session_service() -> SessionService:
    """Dependency to get session service"""
    return session_service


def get_collaboration_service() -> CollaborationService:
    """Dependency to get collaboration service"""
    return collaboration_service


def get_session_id(
    session: Optional[str] = Query(default=None, description="Session ID from query parameter")
) -> Optional[str]:
    """Get session ID from query parameter"""
    return session


def get_user_id(
    user_id: Optional[str] = Cookie(default=None, alias="user_id")
) -> Optional[str]:
    """Get user ID from cookie"""
    return user_id
