"""FastAPI app — Phase 2 + 3.

Endpoints:
  GET  /health        → liveness check
  POST /ingest        → index/re-index source_docs/
  POST /chat          → grounded Q&A with session memory
  GET  /widget/*      → serves embeddable widget files (Phase 3)
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.llm import configure_llm
from app import rag
from app.schemas import ChatRequest, ChatResponse, SourceRef, IngestResponse, HealthResponse

# In-memory session store: session_id → list of {"role": "user"|"assistant", "content": str}
_sessions: dict[str, list[dict]] = {}
_index = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _index
    configure_llm()
    try:
        _index = rag.load_index()
    except Exception:
        # No index yet — user must POST /ingest before chatting
        pass
    yield


app = FastAPI(title="Company Knowledge Chatbot", lifespan=lifespan)

# Allow the widget to call the API from any origin (required for cross-site embedding)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Serve /widget/widget.js and /widget/widget.html as static files
_widget_dir = Path(__file__).parent.parent / "widget"
if _widget_dir.exists():
    app.mount("/widget", StaticFiles(directory=str(_widget_dir)), name="widget")


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok")


@app.post("/ingest", response_model=IngestResponse)
def ingest():
    global _index
    result = rag.ingest()
    _index = rag.load_index()
    return IngestResponse(**result)


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    global _index
    if _index is None:
        raise HTTPException(
            status_code=503,
            detail="Knowledge base not loaded. POST /ingest first.",
        )

    history = _sessions.get(req.session_id, [])
    result = rag.answer(req.message, index=_index, chat_history=history)

    _sessions[req.session_id] = history + [
        {"role": "user", "content": req.message},
        {"role": "assistant", "content": result["answer"]},
    ]

    return ChatResponse(
        answer=result["answer"],
        sources=[SourceRef(**s) for s in result["sources"]],
        handoff=result["handoff"],
    )
