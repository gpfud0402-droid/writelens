"""
⑦ LLM API 루브릭 평가: RAG로 공식 루브릭 검색 → 점수·근거·오류·아이디어 전개 분석
⑧ 에이전트가 핵심 약점 선택
⑨ 맞춤형 수정 훈련: 질문 제시·힌트 제공·부분 재작성
"""
import json
from openai import OpenAI
from app.config import settings
from app.rag_retriever import retrieve_context
from app.schemas import RubricEvaluation, RubricScore

_client = OpenAI(api_key=settings.OPENAI_API_KEY)

_SYSTEM_PROMPT = """당신은 공인된 TOEFL Writing 채점관 겸 코칭 튜터입니다.
반드시 제공된 [공식 루브릭 근거]에 기반해서만 평가하세요. 근거에 없는 기준을 임의로 만들지 마세요.
평가는 JSON으로만 출력합니다. 다른 텍스트를 덧붙이지 마세요."""

_USER_PROMPT_TEMPLATE = """[공식 루브릭 근거 / 고득점 예시 발췌]
{rag_context}

[문제(Task Prompt)]
{task_prompt}

[학생 답안 — OCR로 인식된 텍스트]
{student_text}

다음 JSON 스키마로만 응답하세요:
{{
  "total_score": 0~5 사이 숫자,
  "criteria_scores": [
    {{"criterion": "Development", "score": 0~5, "evidence": "답안 근거 설명"}},
    {{"criterion": "Organization", "score": 0~5, "evidence": "..."}},
    {{"criterion": "Language Use", "score": 0~5, "evidence": "..."}}
  ],
  "key_weaknesses": ["가장 우선적으로 고쳐야 할 약점 1~3개"],
  "coaching_questions": ["학생이 스스로 생각해보게 만드는 질문 2~3개"],
  "rewrite_hint": "약점 하나를 골라 어떻게 다시 쓰면 좋을지 보여주는 부분 예시 문장"
}}
"""


def evaluate_essay(student_text: str, task_prompt: str, task_type: str = "Independent") -> RubricEvaluation:
    rag_context = retrieve_context(query=student_text[:800], task_type=task_type)

    response = _client.chat.completions.create(
        model=settings.LLM_MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": _USER_PROMPT_TEMPLATE.format(
                    rag_context=rag_context,
                    task_prompt=task_prompt,
                    student_text=student_text,
                ),
            },
        ],
        temperature=0.3,
    )

    data = json.loads(response.choices[0].message.content)

    return RubricEvaluation(
        task_type=task_type,
        total_score=data["total_score"],
        criteria_scores=[RubricScore(**c) for c in data["criteria_scores"]],
        key_weaknesses=data["key_weaknesses"],
        coaching_questions=data["coaching_questions"],
        rewrite_hint=data["rewrite_hint"],
    )
