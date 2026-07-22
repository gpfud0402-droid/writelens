"""
③ 문서 전처리: 종이 검출 · 기울기 보정 · 밝기 보정
④ NPU 손글씨 인식의 앞단인 글줄 검출까지 포함
"""
import cv2
import numpy as np
from typing import List, Tuple


def load_image(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("이미지를 디코딩할 수 없습니다.")
    return img


def detect_paper_and_warp(img: np.ndarray) -> np.ndarray:
    """가장 큰 사각형 윤곽선(종이)을 찾아 원근 보정(perspective warp)."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blur, 50, 150)
    contours, _ = cv2.findContours(edged, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    paper_contour = None
    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            paper_contour = approx
            break

    if paper_contour is None:
        return img  # 종이 윤곽을 못 찾으면 원본 유지

    pts = paper_contour.reshape(4, 2).astype("float32")
    rect = _order_points(pts)
    (tl, tr, br, bl) = rect

    width = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    height = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))

    dst = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype="float32")
    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(img, M, (width, height))


def _order_points(pts: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # top-left
    rect[2] = pts[np.argmax(s)]   # bottom-right
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # top-right
    rect[3] = pts[np.argmax(diff)]  # bottom-left
    return rect


def correct_brightness(img: np.ndarray) -> np.ndarray:
    """CLAHE로 밝기/대비 보정."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l2 = clahe.apply(l)
    return cv2.cvtColor(cv2.merge((l2, a, b)), cv2.COLOR_LAB2BGR)


def deskew(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.bitwise_not(gray)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) == 0:
        return img
    angle = cv2.minAreaRect(coords)[-1]
    angle = -(90 + angle) if angle < -45 else -angle
    (h, w) = img.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def segment_lines(img: np.ndarray) -> List[np.ndarray]:
    """글줄 검출: 수평 투영(projection profile) 기반 라인 분할."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
    row_sums = thresh.sum(axis=1)
    threshold = row_sums.max() * 0.05

    lines: List[Tuple[int, int]] = []
    in_line, start = False, 0
    for y, val in enumerate(row_sums):
        if val > threshold and not in_line:
            in_line, start = True, y
        elif val <= threshold and in_line:
            in_line = False
            if y - start > 8:  # 너무 얇은 노이즈 라인 제거
                lines.append((start, y))

    return [img[max(0, s - 4):e + 4] for s, e in lines]


def preprocess_pipeline(image_bytes: bytes) -> List[np.ndarray]:
    """③ 전처리 전체 실행 → 줄 단위 이미지 리스트 반환 (④ OCR 입력)"""
    img = load_image(image_bytes)
    img = detect_paper_and_warp(img)
    img = correct_brightness(img)
    img = deskew(img)
    return segment_lines(img)
