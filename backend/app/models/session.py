from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID, uuid4


class Session(BaseModel):
    """BPMN editor session model"""
    id: UUID = Field(default_factory=uuid4, description="Unique session identifier")
    bpmn_xml: Optional[str] = Field(default=None, description="Current BPMN diagram XML")
