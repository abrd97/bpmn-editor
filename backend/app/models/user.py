from pydantic import BaseModel, Field
from uuid import uuid4


class User(BaseModel):
    """User model for collaboration"""
    id: str = Field(default_factory=lambda: str(uuid4()), description="Unique user identifier")
    name: str = Field(..., description="User display name")
    color: str = Field(..., description="User color for UI in hex format")
