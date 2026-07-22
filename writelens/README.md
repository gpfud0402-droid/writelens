# WriteLens — 기술 스택 구현 가이드

PRD 9장 "기술 스택"을 실제로 구현하기 위한 오픈소스/API 목록과 최소 동작 코드입니다.

## 1. 구성 요소별 필요 오픈소스 / API

| 구성 요소 | 필요한 것 | 비고 |
|---|---|---|
| 손글씨 인식 (OCR) | **Furiosa SDK** (`furiosa-sdk`, `furiosa-runtime`), **TrOCR** (`transformers`의 `microsoft/trocr-base-handwritten`), `onnx`, `onnxruntime` | 허깅페이스 TrOCR을 ONNX로 export → Furiosa 컴파일러(`furiosa-compiler`)로 `.enf` 바이너리 생성 → `furiosa-runtime`으로 NPU 추론. Furiosa 실물 보드/드라이버 없으면 `onnxruntime` CPU 폴백으로 개발 가능 |
| 문서 전처리 | `opencv-python`, `numpy`, `Pillow` | 종이 검출, 기울기 보정(deskew), 밝기 보정, 글줄 분할 |
| LLM API | `openai` (GPT API) | 루브릭 평가 + 코칭 생성, JSON 구조화 출력(`response_format={"type":"json_object"}`) |
| RAG | `chromadb`(로컬 벡터DB) 또는 `faiss-cpu`, `sentence-transformers` 혹은 `openai` 임베딩 | 공식 TOEFL Writing 루브릭 + 고득점 예시 답안을 청크로 저장, 질의 시 top-k 검색 |
| 백엔드 오케스트레이션 | `fastapi`, `uvicorn`, `pydantic` | 전처리→OCR→평가→코칭 파이프라인을 하나의 API로 노출 |
| 프론트엔드 | React, `react-webcam`(또는 `navigator.mediaDevices.getUserMedia` 직접 사용) | 이미지 업로드/카메라 캡처, 원본·수정본 비교 뷰어(`diff`는 `diff-match-patch` 또는 `react-diff-viewer`) |

## 2. 설치

```bash
# 백엔드
pip install fastapi uvicorn pydantic openai chromadb sentence-transformers \
            opencv-python-headless Pillow numpy onnxruntime transformers torch \
            furiosa-sdk furiosa-runtime   # Furiosa 보드가 없으면 이 두 줄은 생략, onnxruntime로 폴백

# 프론트엔드
npm install react-webcam diff-match-patch
```

Furiosa NPU가 없는 개발 환경에서는 `ocr_furiosa.py`의 `USE_NPU=False` 플래그로 자동으로 `onnxruntime` CPU 추론으로 전환되도록 만들어 두었습니다. 실제 보드에 배포할 때만 `True`로 바꾸면 됩니다.

## 3. 폴더 구조

```
backend/
  requirements.txt
  app/
    config.py        # 환경변수, 모델 경로
    schemas.py        # Pydantic 요청/응답 스키마
    preprocessing.py  # OpenCV 전처리 (③ 단계)
    ocr_furiosa.py     # Furiosa NPU 손글씨 인식 (④ 단계)
    rag_retriever.py   # 루브릭/예시답안 RAG (⑦ 단계 보조)
    llm_rubric.py      # GPT 루브릭 평가·코칭 (⑦~⑨ 단계)
    pipeline.py        # 전체 오케스트레이션
    main.py            # FastAPI 엔드포인트
frontend/
  src/
    WritingCoach.jsx   # 업로드/카메라 캡처 + 원본·수정본 비교 뷰어
```

PRD의 파이프라인 번호(①~⑩)와 코드 주석을 맞춰 두었으니, 어떤 코드가 PRD의 어느 단계인지 바로 대응됩니다.
