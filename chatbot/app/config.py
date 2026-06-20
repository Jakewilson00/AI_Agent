"""Central settings — all values come from .env, never hard-coded."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class _Settings:
    openai_api_key: str = os.environ.get("OPENAI_API_KEY", "")
    llm_model: str = os.environ.get("LLM_MODEL", "gpt-4o-mini")
    embed_model: str = os.environ.get("EMBED_MODEL", "text-embedding-3-small")
    temperature: float = float(os.environ.get("TEMPERATURE", "0.1"))
    top_k: int = int(os.environ.get("TOP_K", "3"))
    similarity_threshold: float = float(os.environ.get("SIMILARITY_THRESHOLD", "0.20"))

    source_docs_dir: Path = Path(os.environ.get("SOURCE_DOCS_DIR", "data/source_docs"))
    chroma_store_dir: Path = Path(os.environ.get("CHROMA_STORE_DIR", "data/chroma_store"))
    chroma_collection: str = os.environ.get("CHROMA_COLLECTION", "knowledge_base")

    system_prompt: str = os.environ.get(
        "SYSTEM_PROMPT",
        (
            "You are a helpful company assistant. "
            "Answer questions ONLY using the provided context documents. "
            "If the answer is not present in the context, say exactly: "
            "'I don't have enough information to answer that — please contact our support team.' "
            "Never invent facts. Be concise."
        ),
    )

settings = _Settings()
