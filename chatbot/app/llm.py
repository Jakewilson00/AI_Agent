"""Provider-agnostic LLM + embedding wrapper.

Swap the provider by changing the imports and constructor here — all other
modules call configure_llm() and then use llama_index.core.Settings, so
nothing else needs to change.
"""
from llama_index.core import Settings
from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding
from app.config import settings


def configure_llm() -> None:
    """Point LlamaIndex at OpenAI using values from config/env."""
    if not settings.openai_api_key:
        raise ValueError(
            "OPENAI_API_KEY is not set. Add it to your .env file."
        )

    Settings.llm = OpenAI(
        model=settings.llm_model,
        api_key=settings.openai_api_key,
        temperature=settings.temperature,
        max_tokens=1024,
    )

    Settings.embed_model = OpenAIEmbedding(
        model=settings.embed_model,
        api_key=settings.openai_api_key,
    )
