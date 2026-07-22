from pydantic import BaseModel
from typing import List, Optional


class OCRLineResult(BaseModel):
    line_index: int
    text: str
    confidence: float
    needs_review: bool  # ⑤ OCR 신뢰도 검사에서 사용자 확인이 필요한 줄인지


class OCRResult(BaseModel):
    raw_text: str
    lines: List[OCRLineResult]
    overall_confidence: float


class RubricScore(BaseModel):
    criterion: str        # 예: "Development", "Organization", "Language Use"
    score: float           # 0~5
    evidence: str          # 해당 점수를 준 근거(답안 인용/설명)


class RubricEvaluation(BaseModel):
    task_type: str  # "Independent" | "Integrated"
    total_score: float
    criteria_scores: List[RubricScore]
    key_weaknesses: List[str]     # ⑧ 에이전트가 선택한 핵심 약점
    coaching_questions: List[str] # ⑨ 맞춤형 수정 훈련 질문
    rewrite_hint: str             # 재작성 힌트/부분 예시


class EvaluateRequest(BaseModel):
    ocr_text: str
    task_prompt: str          # 학생이 선택한 문제(Email/Academic Discussion)
    task_type: str = "Independent"


class EvaluateResponse(BaseModel):
    ocr_result: Optional[OCRResult] = None
    evaluation: RubricEvaluation


class ReviseCompareRequest(BaseModel):
    original_text: str
    revised_text: str


class ReviseCompareResponse(BaseModel):
    original_text: str
    revised_text: str
    revised_evaluation: RubricEvaluation
    score_delta: float
