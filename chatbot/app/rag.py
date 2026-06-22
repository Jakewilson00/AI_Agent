"""Ingest + retrieve + answer pipeline.

Ingestion: source_docs/ → load → chunk → embed → ChromaDB
Answering:  question → embed → retrieve top-K → filter by threshold → LLM → answer + sources
"""
import chromadb
from pathlib import Path
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, StorageContext, Settings
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.core.node_parser import SentenceSplitter
from llama_index.vector_stores.chroma import ChromaVectorStore
from app.config import settings


def _chroma_client() -> chromadb.PersistentClient:
    settings.chroma_store_dir.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(settings.chroma_store_dir))


def ingest() -> dict:
    """Load all files in source_docs/, embed them, and store in ChromaDB.

    Re-running this fully replaces the index (no stale chunks left behind).
    """
    source_dir = settings.source_docs_dir
    source_dir.mkdir(parents=True, exist_ok=True)

    files = [f for f in source_dir.iterdir() if f.is_file() and not f.name.startswith(".")]
    if not files:
        raise ValueError(
            f"No documents found in '{source_dir}'. "
            "Drop .txt, .pdf, or .md files there and try again."
        )

    docs = SimpleDirectoryReader(str(source_dir)).load_data()

    client = _chroma_client()
    # Delete and recreate the collection so re-ingest is always clean (FR4)
    try:
        client.delete_collection(settings.chroma_collection)
    except Exception:
        pass
    collection = client.create_collection(settings.chroma_collection)

    vector_store = ChromaVectorStore(chroma_collection=collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    splitter = SentenceSplitter(
        chunk_size=settings.chunk_size, chunk_overlap=settings.chunk_overlap
    )
    VectorStoreIndex.from_documents(
        docs, storage_context=storage_context, transformations=[splitter], show_progress=True
    )

    unique_files = {d.metadata.get("file_name", "unknown") for d in docs}
    return {"documents_indexed": len(unique_files), "chunks_created": collection.count()}


def load_index() -> VectorStoreIndex:
    """Load the existing index from ChromaDB (call after ingest)."""
    client = _chroma_client()
    collection = client.get_collection(settings.chroma_collection)
    vector_store = ChromaVectorStore(chroma_collection=collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    return VectorStoreIndex.from_vector_store(vector_store, storage_context=storage_context)


_CONDENSE_PROMPT = (
    "Given the conversation so far and a follow-up message, rewrite the follow-up "
    "into a standalone question that includes any context it relies on from earlier "
    "turns. Keep it concise. If the follow-up is already self-contained, return it "
    "unchanged. Return ONLY the rewritten question, nothing else.\n\n"
    "Conversation:\n{history}\n\nFollow-up: {question}\n\nStandalone question:"
)


def _condense_question(question: str, chat_history: list[dict]) -> str:
    """Rewrite a follow-up into a standalone question using recent history.

    This lets follow-ups like "how many days did you say?" retrieve the right
    chunks instead of wrongly handing off (FR3). No history → return as-is.
    """
    if not chat_history:
        return question

    history_text = "\n".join(
        f"{turn['role'].capitalize()}: {turn['content']}" for turn in chat_history[-6:]
    )
    prompt = _CONDENSE_PROMPT.format(history=history_text, question=question)
    response = Settings.llm.complete(prompt)
    rewritten = str(response).strip()
    return rewritten or question


def answer(question: str, index: VectorStoreIndex | None = None, chat_history: list[dict] | None = None) -> dict:
    """Retrieve relevant chunks and generate a grounded answer with citations.

    Returns:
        {
            "answer": str,
            "sources": [{"source": str, "snippet": str}],
            "handoff": bool,   # True when no confident grounded answer exists
        }
    """
    if index is None:
        index = load_index()

    # Rewrite follow-ups into standalone questions so retrieval has full context.
    search_query = _condense_question(question, chat_history or [])

    retriever = index.as_retriever(similarity_top_k=settings.top_k)
    nodes = retriever.retrieve(search_query)

    relevant = [n for n in nodes if n.score is not None and n.score >= settings.similarity_threshold]

    if not relevant:
        return {
            "answer": (
                "I don't have enough information to answer that — "
                "please contact our support team."
            ),
            "sources": [],
            "handoff": True,
        }

    context = "\n\n---\n\n".join(n.text for n in relevant)

    messages = [ChatMessage(role=MessageRole.SYSTEM, content=settings.system_prompt)]

    for turn in (chat_history or []):
        role = MessageRole.USER if turn["role"] == "user" else MessageRole.ASSISTANT
        messages.append(ChatMessage(role=role, content=turn["content"]))

    # Use the condensed standalone question so the model isn't tripped up by
    # conversational phrasing ("how many days did you say?") and answers from
    # the retrieved context directly.
    messages.append(
        ChatMessage(
            role=MessageRole.USER,
            content=f"Context:\n{context}\n\nQuestion: {search_query}",
        )
    )

    response = Settings.llm.chat(messages)

    sources = [
        {
            "source": n.metadata.get("file_name", "unknown"),
            "snippet": n.text[:200].strip(),
        }
        for n in relevant
    ]

    return {
        "answer": response.message.content,
        "sources": sources,
        "handoff": False,
    }
