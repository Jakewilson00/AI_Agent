#!/usr/bin/env python3
"""Phase 1 CLI — ingest documents and chat in the terminal.

Usage:
    python cli.py ingest   # index everything in data/source_docs/
    python cli.py chat     # start an interactive chat session
"""
import sys
from app.llm import configure_llm
from app import rag


def cmd_ingest():
    print("Ingesting documents from data/source_docs/ ...")
    result = rag.ingest()
    print(
        f"\nDone — {result['documents_indexed']} document(s), "
        f"{result['chunks_created']} chunk(s) indexed."
    )


def cmd_chat():
    print("Loading knowledge base ...")
    index = rag.load_index()
    print("Ready. Ask a question or type 'quit' to exit.\n")

    while True:
        try:
            question = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            break

        if not question:
            continue
        if question.lower() in ("quit", "exit", "q"):
            print("Bye.")
            break

        result = rag.answer(question, index=index)
        print(f"\nBot: {result['answer']}\n")

        if result["sources"]:
            print("Sources:")
            for s in result["sources"]:
                print(f"  [{s['source']}] {s['snippet'][:120]} ...")
        elif result["handoff"]:
            print("(No relevant content found in the knowledge base.)")

        print()


def main():
    configure_llm()
    command = sys.argv[1] if len(sys.argv) > 1 else "chat"

    if command == "ingest":
        cmd_ingest()
    elif command == "chat":
        cmd_chat()
    else:
        print(f"Unknown command: {command!r}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
