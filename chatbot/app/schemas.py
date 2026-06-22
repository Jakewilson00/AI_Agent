"""Pydantic request/response models for the FastAPI endpoints."""
from pydantic import BaseModel


class ChatRequest(BaseModel):
    session_id: str
    message: str


class SourceRef(BaseModel):
    source: str
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceRef]
    handoff: bool


class IngestResponse(BaseModel):
    documents_indexed: int
    chunks_created: int


class HealthResponse(BaseModel):
    status: str


class StatsResponse(BaseModel):
    total_questions: int
    total_handoffs: int
