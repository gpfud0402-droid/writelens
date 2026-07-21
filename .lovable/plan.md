# WriteLens 2일 MVP 프로토타입 계획

## 목표
- TOEFL Writing 손글씨 답안 사진 업로드 → OCR → 루브릭 평가 → 재작성 훈련까지의 핵심 플로우를 2일 만에 구현
- 내일 받을 Furiosa Renegade NPU와 연결할 수 있는 구조를 미리 설계하고, NPU 준비 전까지는 Cloud OCR로 동작하는 데모 확보
- Google Cloud Vertex AI Gemini로 루브릭 기반 채점·코칭 생성

## 기술 스택
- **프레임워크**: TanStack Start (기존 Lovable 프로젝트)
- **스타일**: Tailwind CSS v4 + shadcn/ui
- **백엔드/데이터**: Lovable Cloud (Supabase) — 답안 이미지·텍스트·피드백 이력 저장
- **OCR**: 어댑터 패턴
  - **Cloud fallback**: Google Cloud Vision API (또는 Gemini vision)
  - **NPU path**: 사용자 로컬 FastAPI 서버가 Furiosa Renegade SDK로 ONNX INT8 모델 추론 → HTTP endpoint로 결과 반환
- **LLM 채점**: Google Cloud Vertex AI Gemini 1.5 Flash / Pro
- **이미지 저장**: Lovable Cloud Storage

## 아키텍처
```text
[브라우저]
  ├── 사진 업로드 / 카메라 촬영
  ├── TOEFL 문제 선택 (Independent / Academic Discussion)
  ├── OCR 결과 보정 (원문 ↔ 수정본, 신뢰도 낮은 단어 하이라이트)
  ├── 루브릭 피드백 확인 (0~5점, 근거, 교정)
  └── 재작성 훈련 + 재평가

[서버 함수]
  ├── OCR Adapter
  │   ├── NPU 모드: POST http://<user-local-npu-server>/ocr
  │   └── Cloud 모드: Google Cloud Vision API / Gemini vision
  ├── analyzeAnswer: 텍스트 구조화, 단어/문법/문단 지표
  └── evaluateWithRubric: RAG 프롬프트 + Gemini로 점수·근거·약점·재작성 질문 생성

[DB]
  ├── submissions: 원본 이미지, OCR 텍스트, 보정 텍스트, 문제 유형
  ├── feedbacks: 루브릭 점수, 근거, 교정, 약점
  └── rewrites: 재작성 시도, 재평가 점수
```

## 1일차: 입력·OCR·보정
1. **프로젝트 설정**
   - Lovable Cloud 활성화 (DB, Storage, Auth)
   - Supabase 마이그레이션: `submissions`, `feedbacks`, `rewrites` 테이블 + RLS + GRANT
   - Google Cloud 연결 설정 (Vertex AI 사용을 위한 서비스 계정 키/connector)

2. **메인 UI 구현** (src/routes/index.tsx)
   - 헤더/브랜드
   - 이미지 업로드 + 드래그앤드롭
   - TOEFL 문제 유형 선택 탭
   - 직접 타이핑 모드 (OCR 없이 테스트용)

3. **OCR 어댑터 구현** (src/lib/ocr.functions.ts)
   - Cloud Vision API 호출
   - NPU endpoint 호출 (URL은 환경변수 또는 UI 입력)
   - 두 결과를 같은 스키마로 정규화: `{text, words: [{text, confidence, bbox}]}`

4. **OCR 보정 UI** (src/components/ocr-correction.tsx)
   - 원문 이미지 옆에 인식 텍스트 노출
   - confidence 낮은 단어 노란/빨강 하이라이트
   - inline editable로 수정 가능

## 2일차: 루브릭 평가·재작성·데모
1. **LLM 루브릭 평가** (src/lib/feedback.functions.ts)
   - TOEFL Independent / Academic Discussion 루브릭을 system prompt에 주입
   - Gemini로 JSON structured output: `{task_response, coherence, language, vocabulary, total_score, reasons, errors, weaknesses, rewrite_questions}`
   - RAG는 MVP에서 루브릭/예시 답안을 system prompt 내용으로 주입 (추후 벡터 검색 확장)

2. **피드백 UI** (src/components/feedback-panel.tsx)
   - 4개 카테고리 점수 + 총점
   - 근거 문장과 문법/어휘 교정 리스트
   - 핵심 약점 1개 선택 및 맞춤 재작성 질문/힌트 노출

3. **재작성 훈련**
   - 사용자가 재작성 문장 입력
   - 서버에서 재평가 및 점수 개선폭 계산
   - 원문 vs 수정본 비교 뷰

4. **데모 샘플/마무리**
   - Independent Task 샘플 이미지/텍스트 제공
   - README: 환경변수, NPU 연결 방법, 로컬 서버 예시 코드

## NPU 연결 방식
- 사용자는 본인 머신에 FastAPI 서버를 띄움: `python npu_server.py` (Furiosa SDK + ONNX TrOCR/PaddleOCR)
- Lovable 앱은 서버 함수에서 해당 로컬 endpoint로 HTTP POST 호출
- NPU 서버가 외부에 노출되려면 ngrok/cloudflare tunnel 필요 (발표 시 같은 네트워크에서 localhost로도 가능)
- 앱 내에 "OCR 모드" 토글: NPU / Cloud
- 두 결과 모두 보여주는 "비교 모드" 추가: NPU 결과 vs Cloud 결과 side-by-side

## 2일 기준 우선순위
- 반드시 Day 1까지: 사진 업로드 → Cloud OCR → 텍스트 보정까지 동작
- 반드시 Day 2까지: Gemini 루브릭 평가 + 점수 UI + 재작성 입력
- NPU 실제 연결은 Day 2 오후 또는 발표 직전 — 미리 FastAPI 서버 템플릿과 연결 코드만 작성

## 리스크
- NPU 모델 변환/포팅이 2일 안에 끝나지 않을 수 있음 → Cloud OCR fallback으로 데모 가능
- Google Cloud Vertex AI credential/connector 설정이 복잡할 수 있음 → Lovable AI Gateway를 임시 fallback으로 두고 병행
- 손글씨 인식 정확도는 필체/촬영 환경에 따라 달라짐 → 보정 UI가 MVP에서 핵심

## 2일 후 완성물
- 배포 가능한 Lovable 웹앱
- Cloud OCR로 동작하는 TOEFL Writing 코칭 데모
- Furiosa Renegade NPU 연결 포인트 및 로컬 서버 예시
- README + 발표용 샘플 데이터