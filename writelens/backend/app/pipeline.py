"""
③ 전처리 → ④ OCR → ⑤ 신뢰도 검사 → ⑥ 구조화 → ⑦ LLM 루브릭 평가 → ⑧ 약점 선택 → ⑨ 코칭
파이프라인 전체를 하나로 묶는 오케스트레이션 계층.
"""
from app.preprocessing import preprocess_pipeline
from app.ocr_furiosa import recognize_lines
from app.llm_rubric import evaluate_essay
from app.schemas import OCRResult, RubricEvaluation


def run_ocr_stage(image_bytes: bytes) -> OCRResult:
    """③④⑤ 단계: 이미지 → 전처리 → 줄 분할 → NPU OCR → 신뢰도 태깅"""
    line_images = preprocess_pipeline(image_bytes)
    return recognize_lines(line_images)


def run_evaluation_stage(ocr_text: str, task_prompt: str, task_type: str) -> RubricEvaluation:
    """⑥⑦⑧⑨ 단계: 텍스트 → RAG 검색 → GPT 루브릭 평가 → 약점/코칭 생성"""
    return evaluate_essay(student_text=ocr_text, task_prompt=task_prompt, task_type=task_type)


def run_full_pipeline(image_bytes: bytes, task_prompt: str, task_type: str = "Independent"):
    ocr_result = run_ocr_stage(image_bytes)

    # ⑤ 신뢰도 검사: 리뷰가 필요한 줄이 있으면 프론트엔드에 그대로 전달해 사용자가 먼저 확인하게 함
    needs_user_review = any(line.needs_review for line in ocr_result.lines)

    evaluation = run_evaluation_stage(
        ocr_text=ocr_result.raw_text,
        task_prompt=task_prompt,
        task_type=task_type,
    )

    return ocr_result, evaluation, needs_user_review


def run_revision_compare(original_text: str, revised_text: str, task_prompt: str, task_type: str):
    """⑩ 재평가: 첫 답안과 수정 답안을 각각 평가해 점수 변화 비교"""
    original_eval = run_evaluation_stage(original_text, task_prompt, task_type)
    revised_eval = run_evaluation_stage(revised_text, task_prompt, task_type)
    delta = revised_eval.total_score - original_eval.total_score
    return original_eval, revised_eval, delta
