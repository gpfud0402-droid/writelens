"""
④ NPU 손글씨 인식: 글줄 검출(전처리에서 완료) → 줄별 OCR → 문장 결합
⑤ OCR 신뢰도 검사: 줄별 confidence가 임계값 미만이면 needs_review=True

구현 노트
---------
Furiosa NPU는 임의의 PyTorch 모델을 바로 돌리지 못하고, 아래 절차로 준비된
컴파일 산출물(.enf)을 furiosa-runtime으로 실행합니다.

  1) 손글씨 인식 모델(TrOCR: microsoft/trocr-base-handwritten)을 로드
  2) torch.onnx.export로 ONNX(.onnx)로 변환
  3) `furiosa compile model.onnx -o model.enf` (furiosa-sdk CLI, NPU 보드/툴체인 필요)
  4) furiosa-runtime의 session.create("model.enf")로 로드해 NPU에서 추론

이 코드에서는 Furiosa 보드가 없는 개발 환경도 그대로 돌아가도록,
config.USE_NPU 플래그에 따라 furiosa-runtime 또는 onnxruntime(CPU)로 분기합니다.
두 경우 모두 pre/post-processing(토크나이저, 이미지 정규화)은 동일합니다.
"""
import numpy as np
from typing import List
from transformers import TrOCRProcessor
from app.config import settings
from app.schemas import OCRLineResult, OCRResult

_processor = TrOCRProcessor.from_pretrained(settings.OCR_HF_MODEL_ID)


class _NPUSession:
    """furiosa-runtime 세션 래퍼"""

    def __init__(self, model_path: str):
        # furiosa-sdk는 배포 환경(NPU 보드)에서만 import 가능하므로 지연 임포트
        from furiosa.runtime import session
        self.sess = session.create(model_path)

    def run(self, pixel_values: np.ndarray) -> np.ndarray:
        return self.sess.run(pixel_values)[0].numpy()


class _CPUSession:
    """onnxruntime 세션 래퍼 (Furiosa 보드 없는 로컬 개발/테스트용)"""

    def __init__(self, model_path: str):
        import onnxruntime as ort
        self.sess = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        self.input_name = self.sess.get_inputs()[0].name

    def run(self, pixel_values: np.ndarray) -> np.ndarray:
        return self.sess.run(None, {self.input_name: pixel_values})[0]


def _get_session():
    if settings.USE_NPU:
        return _NPUSession(settings.OCR_MODEL_PATH_NPU)
    return _CPUSession(settings.OCR_MODEL_PATH_CPU)


_session = None


def _session_singleton():
    global _session
    if _session is None:
        _session = _get_session()
    return _session


def _decode_line(line_img: np.ndarray) -> OCRLineResult:
    pixel_values = _processor(images=line_img, return_tensors="np").pixel_values
    logits = _session_singleton().run(pixel_values)  # (1, seq_len, vocab_size)

    token_ids = logits.argmax(axis=-1)
    text = _processor.batch_decode(token_ids, skip_special_tokens=True)[0].strip()

    probs = _softmax(logits)
    token_confidences = probs.max(axis=-1)[0]
    confidence = float(token_confidences.mean()) if len(token_confidences) else 0.0

    return OCRLineResult(
        line_index=-1,  # 호출부에서 채움
        text=text,
        confidence=confidence,
        needs_review=confidence < settings.OCR_CONFIDENCE_THRESHOLD,
    )


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - x.max(axis=-1, keepdims=True))
    return e / e.sum(axis=-1, keepdims=True)


def recognize_lines(line_images: List[np.ndarray]) -> OCRResult:
    """줄 이미지 리스트 → 줄별 OCR + 문장 결합"""
    line_results: List[OCRLineResult] = []
    for i, line_img in enumerate(line_images):
        result = _decode_line(line_img)
        result.line_index = i
        line_results.append(result)

    raw_text = " ".join(r.text for r in line_results)
    overall_confidence = (
        sum(r.confidence for r in line_results) / len(line_results) if line_results else 0.0
    )

    return OCRResult(raw_text=raw_text, lines=line_results, overall_confidence=overall_confidence)
