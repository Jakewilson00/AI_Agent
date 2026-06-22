# AI Company Knowledge Chatbot

A grounded RAG chatbot that answers questions strictly from your company's own documents. No hallucinations — if the answer isn't in your docs, it says so and hands off to your team.

---

## How it works

1. You drop your company's documents (PDF, TXT, Markdown) into `data/source_docs/`.
2. A one-time ingest command reads, chunks, embeds, and stores them in a local vector database.
3. When a user asks a question, the bot retrieves the most relevant passages and generates a grounded answer with source citations.
4. If no relevant passage is found above the confidence threshold, the bot replies with a handoff message instead of guessing.

---

## Setup

### 1. Prerequisites

- Python 3.11 or newer
- An OpenAI API key ([get one here](https://platform.openai.com/account/api-keys))

### 2. Install dependencies

```bash
cd chatbot
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set your API key:

```
OPENAI_API_KEY=sk-...
```

All other values have sensible defaults — you don't need to change them to get started.

### 4. Add your documents

Drop your company's files into `data/source_docs/`. Supported formats: `.pdf`, `.txt`, `.md`.

```
data/
  source_docs/
    your-faq.pdf
    your-policies.md
    product-guide.txt
```

---

## Running the bot

### Step 1 — Ingest your documents

This reads everything in `source_docs/`, creates embeddings, and stores them in the local vector database. Run this once, and re-run it any time documents change.

```bash
cd chatbot
python cli.py ingest
```

Output: number of documents indexed and chunks created.

### Step 2 — Start the API server

```bash
cd chatbot
uvicorn app.main:app --reload
```

The server starts at `http://localhost:8000`.

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check — returns `{"status": "ok"}` |
| `POST` | `/ingest` | Index/re-index `source_docs/` |
| `POST` | `/chat` | Send a message, get a grounded answer |
| `GET` | `/stats` | Total questions asked and handoff count |

### Chat request/response

**Request:**
```json
{ "session_id": "user-abc", "message": "What is your return policy?" }
```

**Response:**
```json
{
  "answer": "You can return any item within 30 days...",
  "sources": [{ "source": "policies.md", "snippet": "Returns are accepted within 30 days..." }],
  "handoff": false
}
```

When `handoff` is `true`, the answer will direct the user to contact your support team.

---

## Embeddable widget

Open `widget/widget.html` in a browser to see the chat bubble demo.

To embed the widget on any website, paste this single tag before `</body>`:

```html
<script
  src="http://YOUR-SERVER-URL/widget/widget.js"
  data-api="http://YOUR-SERVER-URL">
</script>
```

Replace `YOUR-SERVER-URL` with the address where your server is running (e.g. `https://your-app.render.com`).

---

## Updating the knowledge base

When your documents change, the process is simple:

1. Add, remove, or edit files in `data/source_docs/`.
2. Run the ingest command again:
   ```bash
   python cli.py ingest
   ```
   Or call the API endpoint:
   ```bash
   curl -X POST http://localhost:8000/ingest
   ```

Re-ingesting fully replaces the index — no stale content is left behind.

---

## Configuration reference

All settings live in `.env`. No code changes needed.

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | _(required)_ | Your OpenAI API key |
| `LLM_MODEL` | `gpt-4o-mini` | Model used to generate answers |
| `EMBED_MODEL` | `text-embedding-3-small` | Model used for embeddings |
| `TEMPERATURE` | `0.1` | Low = more factual, less creative |
| `TOP_K` | `3` | Number of chunks retrieved per question |
| `SIMILARITY_THRESHOLD` | `0.20` | Minimum score for a chunk to count as relevant |
| `CHUNK_SIZE` | `256` | Chunk size in tokens. Smaller = cleaner topic separation for dense FAQ docs |
| `CHUNK_OVERLAP` | `32` | Token overlap between adjacent chunks |
| `SOURCE_DOCS_DIR` | `data/source_docs` | Where to read client documents from |
| `CHROMA_STORE_DIR` | `data/chroma_store` | Where the vector database is stored |
| `STATS_DB_PATH` | `data/stats.db` | Where question/handoff stats are stored |
| `SYSTEM_PROMPT` | _(see config.py)_ | Override the bot's instructions entirely |

---

## Cost notes

Using the defaults (`gpt-4o-mini` + `text-embedding-3-small`):

- **Embeddings (ingest):** ~$0.00002 per 1K tokens. A 50-page document ≈ 25K tokens ≈ **$0.0005 total** — essentially free.
- **Chat (per question):** Each answer call sends ~1–2K tokens (context + question + history). At ~$0.15/1M input tokens and $0.60/1M output tokens for `gpt-4o-mini`, a typical question costs **under $0.001**. Follow-up questions add one small extra call (to rewrite the follow-up into a standalone question for accurate retrieval) — a negligible fraction of a cent.
- **Rule of thumb:** 1,000 questions ≈ $0.50–$1.00.

To reduce costs further, lower `TOP_K` (fewer context chunks per question) or set `LLM_MODEL` to a cheaper model.

Set a [spending cap](https://platform.openai.com/settings/organization/limits) in your OpenAI dashboard to prevent runaway costs.

---

## Project structure

```
chatbot/
  app/
    main.py       # FastAPI routes
    llm.py        # LLM + embedding provider (swap here to change model)
    rag.py        # Ingest and answer pipeline
    stats.py      # SQLite-backed question/handoff counter
    config.py     # All settings from .env
    schemas.py    # Pydantic request/response models
  data/
    source_docs/  # Drop client documents here
    chroma_store/ # Vector DB (auto-created, gitignored)
    stats.db      # Stats database (auto-created)
  widget/
    widget.html   # Demo page
    widget.js     # Embeddable chat bubble
  cli.py          # Command-line ingest + chat
  requirements.txt
  .env.example
```
