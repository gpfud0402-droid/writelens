import React, { useRef, useState, useCallback } from "react";

// 백엔드 API 베이스 URL (환경변수로 분리 권장)
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

export default function WritingCoach() {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [taskPrompt, setTaskPrompt] = useState("");
  const [taskType, setTaskType] = useState("Independent");

  const [ocrResult, setOcrResult] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [revisedText, setRevisedText] = useState("");
  const [revisedEval, setRevisedEval] = useState(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ② 답안 입력 — 파일 업로드
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  // ② 답안 입력 — 실시간 카메라 캡처
  const openCamera = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
    setIsCameraOpen(true);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(blob));
    }, "image/jpeg");

    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsCameraOpen(false);
  }, []);

  // ③~⑨ 파이프라인 호출
  const submitForEvaluation = async () => {
    if (!imageFile || !taskPrompt) return;
    const form = new FormData();
    form.append("image", imageFile);
    form.append("task_prompt", taskPrompt);
    form.append("task_type", taskType);

    const res = await fetch(`${API_BASE}/api/evaluate`, { method: "POST", body: form });
    const data = await res.json();
    setOcrResult(data.ocr_result);
    setEvaluation(data.evaluation);
    setRevisedText(data.ocr_result.raw_text); // 사용자가 이 텍스트를 고쳐 쓰게 초기값 세팅
  };

  // ⑩ 재평가: 원본 vs 수정본 비교
  const submitRevisionCompare = async () => {
    const res = await fetch(
      `${API_BASE}/api/revise-compare?task_prompt=${encodeURIComponent(taskPrompt)}&task_type=${taskType}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_text: ocrResult.raw_text,
          revised_text: revisedText,
        }),
      }
    );
    const data = await res.json();
    setRevisedEval(data);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">WriteLens — 손글씨 TOEFL Writing 코칭</h1>

      {/* ① 문제 선택 */}
      <section className="space-y-2">
        <label className="block font-medium">문제(Task Prompt)</label>
        <textarea
          className="w-full border rounded p-2"
          rows={3}
          value={taskPrompt}
          onChange={(e) => setTaskPrompt(e.target.value)}
          placeholder="예: Email / Academic Discussion 문제를 붙여넣으세요"
        />
        <select
          className="border rounded p-2"
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
        >
          <option value="Independent">Independent</option>
          <option value="Integrated">Integrated</option>
        </select>
      </section>

      {/* ② 답안 입력: 업로드 / 카메라 */}
      <section className="space-y-2">
        <label className="block font-medium">손글씨 답안 이미지</label>
        <div className="flex gap-3">
          <input type="file" accept="image/*" onChange={handleFileChange} />
          <button className="px-3 py-1 border rounded" onClick={openCamera}>
            카메라로 촬영
          </button>
        </div>

        {isCameraOpen && (
          <div className="space-y-2">
            <video ref={videoRef} autoPlay playsInline className="w-full rounded border" />
            <button className="px-3 py-1 bg-black text-white rounded" onClick={capturePhoto}>
              캡처
            </button>
          </div>
        )}

        {imagePreviewUrl && (
          <img src={imagePreviewUrl} alt="답안 미리보기" className="w-full rounded border" />
        )}

        <button
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          onClick={submitForEvaluation}
          disabled={!imageFile || !taskPrompt}
        >
          인식 및 평가 시작
        </button>
      </section>

      {/* ⑤ OCR 신뢰도 검사 — 불확실한 단어 확인 */}
      {ocrResult && (
        <section className="space-y-2">
          <h2 className="font-semibold">인식된 텍스트 (신뢰도 낮은 줄은 강조 표시)</h2>
          <div className="border rounded p-3 space-y-1">
            {ocrResult.lines.map((line) => (
              <p
                key={line.line_index}
                className={line.needs_review ? "bg-yellow-100 px-1 rounded" : ""}
                title={`confidence: ${line.confidence.toFixed(2)}`}
              >
                {line.text}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* ⑦⑧⑨ 루브릭 평가 + 코칭 */}
      {evaluation && (
        <section className="space-y-2">
          <h2 className="font-semibold">루브릭 평가 (총점 {evaluation.total_score} / 5)</h2>
          <ul className="list-disc pl-5">
            {evaluation.criteria_scores.map((c) => (
              <li key={c.criterion}>
                <strong>{c.criterion}</strong>: {c.score} — {c.evidence}
              </li>
            ))}
          </ul>

          <h3 className="font-medium mt-3">핵심 약점</h3>
          <ul className="list-disc pl-5">
            {evaluation.key_weaknesses.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>

          <h3 className="font-medium mt-3">코칭 질문</h3>
          <ul className="list-disc pl-5">
            {evaluation.coaching_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>

          <p className="italic mt-2">재작성 힌트: {evaluation.rewrite_hint}</p>
        </section>
      )}

      {/* 원본·수정본 비교 뷰어 */}
      {ocrResult && (
        <section className="space-y-2">
          <h2 className="font-semibold">원본 vs 수정본</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm text-gray-500 mb-1">원본 (OCR 인식 결과)</h3>
              <div className="border rounded p-2 h-48 overflow-auto whitespace-pre-wrap">
                {ocrResult.raw_text}
              </div>
            </div>
            <div>
              <h3 className="text-sm text-gray-500 mb-1">수정본 (직접 편집)</h3>
              <textarea
                className="w-full border rounded p-2 h-48"
                value={revisedText}
                onChange={(e) => setRevisedText(e.target.value)}
              />
            </div>
          </div>

          <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={submitRevisionCompare}>
            수정본 재평가
          </button>

          {revisedEval && (
            <p className="font-medium">
              점수 변화: {revisedEval.score_delta > 0 ? "+" : ""}
              {revisedEval.score_delta.toFixed(1)}점 (총점 {revisedEval.revised_evaluation.total_score})
            </p>
          )}
        </section>
      )}
    </div>
  );
}
