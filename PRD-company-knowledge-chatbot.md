# PRD — AI Company Knowledge Chatbot (MVP)

**Document type:** Product Requirements Document
**Owner:** (you)
**Status:** Draft v1 — ready to build
**Intended use:** Feed this file to an AI coding agent (e.g. Claude in Cursor) as the source of truth for building the product, phase by phase.

---

## 0. How to use this PRD with an AI coding agent

1. Open an empty project folder in Cursor and drop this file in the root.
2. Tell the agent: *"Read PRD-company-knowledge-chatbot.md. Build Phase 1 only. Stop after Phase 1's acceptance criteria pass, then wait for my review."*
3. Build one phase at a time. Do **not** let the agent build all phases at once — review and run each phase first.
4. After each phase, ask the agent to write/run the tests listed under that phase's Acceptance Criteria.

> Builder is a complete beginner. The agent should explain each file it creates in one sentence, prefer clarity over cleverness, and never introduce a dependency without saying why.

---

## 1. Overview & vision

A reusable chatbot that answers questions **strictly from a single company's own content** (help docs, FAQs, policies, product info). It can be deployed for any client by swapping in that client's documents — no code changes. It is grounded (no made-up answers), cites its sources, and gracefully hands off to a human when it doesn't know.

This MVP is **single-tenant** (one client per deployment). It is deliberately designed so it can later grow into a multi-tenant SaaS without rebuilding the core.

## 2. Goals & non-goals

**Goals**
- Answer user questions using only the ingested company content (RAG).
- Show source citations for every answer.
- Be embeddable on any website via a single `<script>` snippet.
- Let a non-technical client refresh the bot's knowledge by re-running an ingest command/endpoint.
- Be provider-agnostic for the LLM so the model can be swapped via config.

**Non-goals (explicitly out of scope for MVP)**
- Multi-tenant accounts, billing, or a sign-up flow.
- Action-taking / tool calling (bookings, CRM writes). Reserved for a later phase.
- Fine-tuning or training a custom model.
- Mobile native apps.
- A full admin dashboard (a minimal stats endpoint is enough for MVP).

## 3. Target users

- **End user:** a visitor on the client's website asking a support/info question.
- **Client admin:** the business owner who provides documents and occasionally updates them.
- **Operator:** you — deploy and maintain the bot per client.

## 4. Tech stack (decided — do not re-litigate)

| Layer | Choice | Notes |
|---|---|---|
| Language | Python 3.11+ | Beginner-friendly, best AI ecosystem |
| Backend | FastAPI | Exposes the chat + ingest endpoints |
| RAG framework | LlamaIndex | Handles chunking, embedding, retrieval |
| Vector store | ChromaDB (local, persistent) | Free, zero-setup for dev. Pinecone/Qdrant later |
| LLM access | Provider-agnostic wrapper | Default to a small/cheap model; set via env |
| Embeddings | Same provider as LLM | e.g. a small embeddings model |
| Front-end widget | Vanilla HTML/CSS/JS | Single embeddable script, no framework |
| Config | `.env` file via `python-dotenv` | API keys + model names live here, never hard-coded |
| Hosting (later) | Render / Railway / Fly.io | Not required to run locally |

**Hard rules for the agent:**
- All secrets and model names come from environment variables. Never commit `.env`. Provide a `.env.example`.
- The LLM and embedding calls must be isolated behind one module (`llm.py`) so the provider can be swapped in one place.
- Default `temperature` = 0.1. The system prompt must instruct the model to answer **only** from retrieved context and to say it doesn't know otherwise.

## 5. Proposed file structure

```
/chatbot
  /app
    main.py            # FastAPI app + routes
    llm.py             # Provider-agnostic LLM + embedding wrapper
    rag.py             # Ingest + retrieve + answer pipeline
    config.py          # Loads env vars, central settings
    schemas.py         # Pydantic request/response models
  /data
    /source_docs       # Client's raw files (pdf, txt, md) go here
    /chroma_store      # Persisted vector DB (gitignored)
  /widget
    widget.html        # Demo page hosting the chat bubble
    widget.js          # Embeddable chat UI
    widget.css
  /tests
    test_phase1.py ...
  .env.example
  .gitignore
  requirements.txt
  README.md
```

## 6. Data flow

**Ingestion (run once per client, re-run on updates):**
`source_docs/` → load files → chunk into passages → create embeddings → store in ChromaDB.

**Answering (every message):**
user question → embed question → retrieve top-K relevant chunks from ChromaDB → build prompt (system prompt + retrieved chunks + recent chat history + question) → call LLM → return answer **+ list of source chunk references**.

## 7. API contract (MVP)

**`POST /chat`**
- Request: `{ "session_id": "string", "message": "string" }`
- Response: `{ "answer": "string", "sources": [{"source": "filename", "snippet": "string"}], "handoff": false }`
- `handoff` is `true` when the bot has no confident grounded answer.

**`POST /ingest`**
- Triggers ingestion of everything in `data/source_docs/`. Returns `{ "documents_indexed": int, "chunks_created": int }`.

**`GET /health`**
- Returns `{ "status": "ok" }`.

**`GET /stats`** (minimal)
- Returns counts of total questions asked and number of handoffs (read from a simple log file or SQLite).

## 8. Functional requirements

- FR1: System answers only from ingested content; if no relevant chunk is retrieved above a similarity threshold, it returns a handoff message instead of guessing.
- FR2: Every non-handoff answer includes at least one source reference.
- FR3: Conversation memory persists within a `session_id` (recent turns included in the prompt).
- FR4: Re-running ingest fully refreshes the index without leftover stale chunks.
- FR5: The system prompt, default model, and top-K are all configurable via env/config without code edits.
- FR6: The widget can be added to any site by pasting one script tag pointing at the backend URL.

## 9. Non-functional requirements

- Response time target: under ~5 seconds for a typical answer.
- Cost control: default to a small/cheap model; document expected per-conversation cost in the README.
- Privacy: never log full API keys; keep client documents local to the deployment.
- Portability: runs locally with `pip install -r requirements.txt` + two commands (ingest, then serve).

## 10. Build phases & acceptance criteria

### Phase 1 — Core RAG over the terminal
Build `llm.py`, `rag.py`, `config.py`, ingestion of `data/source_docs/`, and a simple command-line loop to ask questions.
**Acceptance:** Place one sample PDF/TXT in `source_docs`, run ingest, ask a question in the terminal, and get a correct answer **with a source reference**. Asking something not in the docs returns a "don't know / handoff" reply, not a fabricated answer.

### Phase 2 — Wrap in FastAPI
Add `main.py` with `/chat`, `/ingest`, `/health`. Add `schemas.py`. Add session-based memory.
**Acceptance:** `/health` returns ok; `/ingest` returns counts; `/chat` returns the JSON contract in §7 including `sources` and `handoff`. Memory works across two messages in the same `session_id`.

### Phase 3 — Embeddable widget
Build the chat bubble in `/widget`, talking to `/chat`. Provide a demo `widget.html`.
**Acceptance:** Opening `widget.html` shows a working chat bubble that sends/receives messages and displays sources. A documented one-line script tag embeds it on an external test page.

### Phase 4 — Guardrails, stats & polish
Tighten the system prompt, add similarity threshold for handoff, add `/stats`, write the README (setup, ingest, run, cost notes, how a client updates docs).
**Acceptance:** Off-topic and out-of-scope questions reliably hand off; `/stats` reports question and handoff counts; README lets a beginner go from clone to running bot.

### Phase 5 (future, not MVP) — Tool calling
Add function/tool calling for one real action (e.g. booking or order lookup). Spec to be written later.

## 11. Risks & mitigations

- **Hallucination** → strict system prompt + low temperature + similarity threshold + citations.
- **Runaway API cost** → small default model, spending cap set in provider dashboard on day one, output length limits.
- **Vendor lock-in** → all model calls isolated in `llm.py`.
- **Stale knowledge** → simple re-ingest command; document it for the client.

## 12. Definition of done (MVP)

A new client's documents can be dropped into `source_docs`, ingested with one command, and the resulting bot answers grounded questions with citations through both the API and the embeddable widget — with off-topic questions handed off rather than guessed.

---

*Build one phase at a time. Review and run each phase before continuing.*
