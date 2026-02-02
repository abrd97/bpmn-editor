from pydantic import BaseModel, Field


class User(BaseModel):
    """User model for collaboration"""
    id: str = Field(..., description="Unique user identifier")
    name: str = Field(..., description="User display name")
    color: str = Field(..., description="User color for UI in hex format")
