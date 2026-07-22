"""
RAG: 공식 TOEFL Writing 루브릭 및 고득점 예시 답안 문서 검색
- 임베딩: sentence-transformers (로컬, API 비용 없음)
- 벡터DB: chromadb (로컬 퍼시스턴트 스토어)

색인 대상 문서는 backend/data/rubric/*.md, backend/data/sample_essays/*.md 형태로
직접 준비해서 넣으면 됩니다 (공식 ETS 루브릭 텍스트 + 고득점 샘플 에세이).
"""
import glob
import os
from typing import List

import chromadb
from chromadb.utils import embedding_functions
from app.config import settings

_client = chromadb.PersistentClient(path=settings.CHROMA_DB_DIR)
_embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name=settings.EMBEDDING_MODEL
)
_collection = _client.get_or_create_collection(
    name="toefl_writing_rubric",
    embedding_function=_embedding_fn,
)


def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    words = text.split()
    chunks = []
    step = chunk_size - overlap
    for i in range(0, len(words), step):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks


def index_directory(dir_path: str, source_tag: str) -> int:
    """루브릭/예시 답안 디렉토리를 통째로 청크 분할 후 색인. 최초 1회 실행하면 됨."""
    count = 0
    for filepath in glob.glob(os.path.join(dir_path, "**/*.md"), recursive=True):
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read()
        for j, chunk in enumerate(_chunk_text(text)):
            doc_id = f"{source_tag}:{os.path.basename(filepath)}:{j}"
            _collection.upsert(
                ids=[doc_id],
                documents=[chunk],
                metadatas=[{"source": source_tag, "file": os.path.basename(filepath)}],
            )
            count += 1
    return count


def retrieve_context(query: str, task_type: str = "Independent", top_k: int = None) -> str:
    """⑦ LLM 평가 직전, 질의(학생 답안 요지 or 태스크 유형)에 맞는 루브릭/예시를 검색."""
    top_k = top_k or settings.RAG_TOP_K
    results = _collection.query(
        query_texts=[f"TOEFL Writing {task_type} rubric: {query}"],
        n_results=top_k,
    )
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]

    context_blocks = []
    for doc, meta in zip(docs, metas):
        context_blocks.append(f"[출처: {meta.get('source')}/{meta.get('file')}]\n{doc}")

    return "\n\n---\n\n".join(context_blocks)
