from pydantic import BaseModel, Field
from typing import Set, Optional
from datetime import datetime
from uuid import UUID, uuid4


class Session(BaseModel):
    """BPMN editor session model"""
    id: UUID = Field(default_factory=uuid4, description="Unique session identifier")
    created_at: datetime = Field(default_factory=datetime.now, description="Session creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update timestamp")
    bpmn_xml: Optional[str] = Field(default=None, description="Current BPMN diagram XML")
    user_ids: Set[str] = Field(default_factory=set, description="Connected user IDs")
