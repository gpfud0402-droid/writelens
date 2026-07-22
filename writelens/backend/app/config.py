import os

class Settings:
    # Furiosa NPU 실물 보드가 있는 배포 서버에서만 True
    USE_NPU: bool = os.getenv("USE_NPU", "false").lower() == "true"

    # ONNX로 export한 TrOCR 모델 경로 (NPU용 컴파일 산출물 .enf 또는 CPU용 .onnx)
    OCR_MODEL_PATH_NPU: str = os.getenv("OCR_MODEL_PATH_NPU", "models/trocr_handwritten.enf")
    OCR_MODEL_PATH_CPU: str = os.getenv("OCR_MODEL_PATH_CPU", "models/trocr_handwritten.onnx")
    OCR_HF_MODEL_ID: str = os.getenv("OCR_HF_MODEL_ID", "microsoft/trocr-base-handwritten")

    # OCR 신뢰도 검사 임계값 (⑤ 단계) — 이보다 낮으면 사용자 확인 요청
    OCR_CONFIDENCE_THRESHOLD: float = float(os.getenv("OCR_CONFIDENCE_THRESHOLD", "0.6"))

    # GPT API
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4.1")

    # RAG 벡터DB 저장 경로 및 임베딩 모델
    CHROMA_DB_DIR: str = os.getenv("CHROMA_DB_DIR", "storage/chroma_toefl_rubric")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", "4"))

settings = Settings()
