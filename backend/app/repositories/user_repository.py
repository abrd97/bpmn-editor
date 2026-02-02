from typing import Optional
from app.models.user import User


class UserRepository:
    """In-memory repository for users"""
    
    def __init__(self):
        self._users: dict[str, User] = {}
    
    def create(self, user: User) -> User:
        """Create a new user"""
        self._users[user.id] = user
        return user
    
    def get(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        return self._users.get(user_id)
    
    def update(self, user: User) -> User:
        """Update existing user"""
        if user.id not in self._users:
            raise ValueError(f"User {user.id} not found")
        self._users[user.id] = user
        return user
    
    def delete(self, user_id: str) -> bool:
        """Delete user by ID"""
        if user_id in self._users:
            del self._users[user_id]
            return True
        return False
    
    def list_all(self) -> list[User]:
        """List all users"""
        return list(self._users.values())


user_repository = UserRepository()
