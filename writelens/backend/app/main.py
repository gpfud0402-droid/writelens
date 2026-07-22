from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

from app.pipeline import run_full_pipeline, run_revision_compare
from app.schemas import (
    EvaluateResponse,
    ReviseCompareRequest,
    ReviseCompareResponse,
)

app = FastAPI(title="WriteLens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 배포 시 프론트엔드 도메인으로 제한
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/evaluate", response_model=EvaluateResponse)
async def evaluate(
    image: UploadFile = File(...),
    task_prompt: str = Form(...),
    task_type: str = Form("Independent"),
):
    """① 문제 선택 + ② 손글씨 이미지 업로드 → ③~⑨ 파이프라인 전체 실행"""
    image_bytes = await image.read()
    ocr_result, evaluation, needs_review = run_full_pipeline(
        image_bytes=image_bytes, task_prompt=task_prompt, task_type=task_type
    )
    # needs_review는 프론트에서 "불확실한 단어 확인" UI를 띄울지 판단하는 데 사용
    return EvaluateResponse(ocr_result=ocr_result, evaluation=evaluation)


@app.post("/api/revise-compare", response_model=ReviseCompareResponse)
async def revise_compare(payload: ReviseCompareRequest, task_prompt: str = "", task_type: str = "Independent"):
    """⑨ 수정 훈련 후 ⑩ 재평가: 원본 vs 수정본 비교"""
    _, revised_eval, delta = run_revision_compare(
        original_text=payload.original_text,
        revised_text=payload.revised_text,
        task_prompt=task_prompt,
        task_type=task_type,
    )
    return ReviseCompareResponse(
        original_text=payload.original_text,
        revised_text=payload.revised_text,
        revised_evaluation=revised_eval,
        score_delta=delta,
    )


@app.get("/api/health")
async def health():
    return {"status": "ok"}
