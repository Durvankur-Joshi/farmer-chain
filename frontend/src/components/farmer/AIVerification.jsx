/**
 * AIVerification.jsx — Phase 2.4
 *
 * AI Crop Quality Verification panel embedded in CropPassportCard.
 *
 * Flow:
 *  1. Farmer selects a JPEG/PNG/WEBP crop image (client-side preview)
 *  2. POST /api/farmer/crops/<cropId>/verify/  (multipart)
 *  3. Backend: IPFS upload → Gemini Vision → validation → DB save
 *  4. Display structured result: grade, score, disease, summary
 *
 * Security:
 *  - File sent to Django, NOT directly to Gemini or Pinata
 *  - No GEMINI_API_KEY or PINATA_JWT ever in this file or VITE_ env vars
 */
import React, { useState, useRef, useCallback } from "react";
import axios from "axios";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES     = 10 * 1024 * 1024; // 10 MB

const GRADE_COLORS = {
  A: "text-green-700 bg-green-100 border-green-300",
  B: "text-lime-700 bg-lime-100 border-lime-300",
  C: "text-yellow-700 bg-yellow-100 border-yellow-300",
  D: "text-orange-700 bg-orange-100 border-orange-300",
  F: "text-red-700 bg-red-100 border-red-300",
};

const GRADE_LABELS = {
  A: "Excellent",
  B: "Good",
  C: "Acceptable",
  D: "Poor",
  F: "Unacceptable",
};

function ScoreBar({ score }) {
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  const color =
    pct >= 80 ? "bg-green-500"
    : pct >= 60 ? "bg-lime-500"
    : pct >= 40 ? "bg-yellow-500"
    : pct >= 20 ? "bg-orange-500"
    : "bg-red-500";
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
      <div
        className={`${color} h-2.5 rounded-full transition-all duration-700`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function VerificationResult({ data, disclaimer }) {
  const v = data;
  const gradeClass = GRADE_COLORS[v.quality_grade] || "text-gray-700 bg-gray-100 border-gray-300";
  const isFailed   = v.verification_status === "failed";

  return (
    <div className={`rounded-xl border p-4 mt-3 ${isFailed ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
      {/* Status badge */}
      <div className="flex justify-between items-center mb-3">
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${isFailed ? "bg-red-200 text-red-800" : "bg-green-200 text-green-800"}`}>
          {isFailed ? "❌ Verification Failed" : "✅ Verification Complete"}
        </span>
        <span className="text-xs text-gray-400">{new Date(v.created_at).toLocaleString()}</span>
      </div>

      {isFailed ? (
        <p className="text-sm text-red-700 font-medium">{v.failure_reason || "Verification could not be completed."}</p>
      ) : (
        <div className="space-y-3">
          {/* Grade + score side by side */}
          <div className="flex gap-3 items-start flex-wrap">
            {/* Quality Grade */}
            <div className={`border rounded-xl px-4 py-2 text-center min-w-[90px] ${gradeClass}`}>
              <p className="text-xs font-semibold uppercase tracking-wide">Quality Grade</p>
              <p className="text-4xl font-extrabold">{v.quality_grade}</p>
              <p className="text-xs">{GRADE_LABELS[v.quality_grade] || ""}</p>
            </div>

            {/* Scores */}
            <div className="flex-1 min-w-[180px] space-y-2">
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-600">
                  <span>Quality Score</span>
                  <span>{v.quality_score}/100</span>
                </div>
                <ScoreBar score={v.quality_score} />
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-600">
                  <span>AI Confidence</span>
                  <span>{Math.round(v.confidence_score * 100)}%</span>
                </div>
                <ScoreBar score={v.confidence_score * 100} />
              </div>
            </div>
          </div>

          {/* Crop detected */}
          <div className="text-sm">
            <span className="font-semibold text-gray-500">Crop Detected: </span>
            <span className="text-gray-800">{v.crop_detected || "—"}</span>
          </div>

          {/* Disease */}
          <div className="text-sm">
            <span className="font-semibold text-gray-500">Disease: </span>
            {v.disease_detected ? (
              <span className="text-red-700 font-semibold">
                ⚠️ Detected — {v.disease_name || "Unknown"}
              </span>
            ) : (
              <span className="text-green-700">✓ Not detected</span>
            )}
          </div>

          {/* Visible defects */}
          <div className="text-sm">
            <span className="font-semibold text-gray-500">Visible Defects: </span>
            <span className="text-gray-800">{v.visible_defects || "None"}</span>
          </div>

          {/* AI Summary */}
          {v.ai_summary && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-700 italic">
              "{v.ai_summary}"
            </div>
          )}

          {/* Image on IPFS */}
          {v.image_gateway_url && (
            <a
              href={v.image_gateway_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 underline"
            >
              🔗 View verified image on IPFS
            </a>
          )}
        </div>
      )}

      {/* Disclaimer — always visible */}
      {disclaimer && (
        <p className="mt-3 text-xs text-gray-400 italic border-t border-gray-200 pt-2">
          ⚠️ {disclaimer}
        </p>
      )}
    </div>
  );
}

export default function AIVerification({ cropId, cropName }) {
  const [file, setFile]             = useState(null);
  const [preview, setPreview]       = useState(null);
  const [step, setStep]             = useState("idle"); // idle | uploading | analyzing | done | error
  const [result, setResult]         = useState(null);   // { verification, disclaimer, error }
  const [clientError, setClientErr] = useState("");
  const [history, setHistory]       = useState(null);   // past verifications
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef                = useRef();

  const reset = () => {
    setFile(null);
    setPreview(null);
    setStep("idle");
    setResult(null);
    setClientErr("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e) => {
    setClientErr("");
    setResult(null);
    const selected = e.target.files[0];
    if (!selected) return;

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setClientErr(`Invalid file type "${selected.type}". Please upload a JPEG, PNG, or WEBP image.`);
      return;
    }
    if (selected.size > MAX_BYTES) {
      setClientErr(`File too large (${(selected.size / 1048576).toFixed(1)} MB). Maximum is 10 MB.`);
      return;
    }

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(selected);
  };

  const handleVerify = async () => {
    if (!file) return setClientErr("Please select an image first.");
    setClientErr("");
    setResult(null);
    setStep("uploading");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setStep("analyzing");
      const res = await axios.post(
        `/api/farmer/crops/${cropId}/verify/`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setResult({
        verification: res.data.verification,
        disclaimer:   res.data.disclaimer,
        error:        null,
      });
      setStep("done");
    } catch (err) {
      const serverErr =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Verification failed. Please try again.";
      const verif = err.response?.data?.verification || null;
      setResult({ verification: verif, disclaimer: null, error: serverErr });
      setStep("error");
    }
  };

  const loadHistory = useCallback(async () => {
    try {
      const res = await axios.get(
        `/api/farmer/crops/${cropId}/verification/`,
        { withCredentials: true }
      );
      setHistory(res.data.verifications || []);
      setShowHistory(true);
    } catch {
      setHistory([]);
      setShowHistory(true);
    }
  }, [cropId]);

  const isRunning = step === "uploading" || step === "analyzing";

  return (
    <div className="border-t border-gray-200 mt-4 pt-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-bold text-gray-700">🤖 AI Quality Verification</h4>
        <button
          onClick={showHistory ? () => setShowHistory(false) : loadHistory}
          className="text-xs text-blue-600 underline"
        >
          {showHistory ? "Hide history" : "View history"}
        </button>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="mb-4 space-y-2">
          {!history || history.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No past verifications.</p>
          ) : (
            history.map((v) => (
              <VerificationResult key={v.id} data={v} disclaimer={null} />
            ))
          )}
        </div>
      )}

      {/* File picker */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <p className="text-xs text-gray-500 mb-2">
          Upload a clear crop image — Gemini Vision will assess quality, detect disease, and assign a grade.
        </p>

        {/* Image preview */}
        {preview && (
          <div className="mb-3 relative w-full max-w-xs">
            <img
              src={preview}
              alt="Crop preview"
              className="rounded-lg border border-gray-300 w-full object-cover max-h-48"
            />
            <button
              onClick={reset}
              className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
              title="Remove image"
            >
            
            </button>
          </div>
        )}

        {/* File input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={isRunning}
          className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 mb-2"
        />
        {file && !clientError && (
          <p className="text-xs text-gray-500 mb-2">
            Selected: <span className="font-semibold">{file.name}</span>
          </p>
        )}

        {/* Client error */}
        {clientError && (
          <p className="text-xs text-red-600 font-medium mb-2">❌ {clientError}</p>
        )}

        {/* Status indicator */}
        {isRunning && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-purple-700 font-semibold">
              {step === "uploading" ? "Uploading image to IPFS…" : "Analyzing with Gemini AI…"}
            </span>
          </div>
        )}

        {/* Verify button */}
        <button
          onClick={handleVerify}
          disabled={!file || isRunning || !!clientError}
          className="bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold w-full"
        >
          {isRunning ? "⏳ Analyzing…" : "🔬 Verify Crop Quality with AI"}
        </button>
      </div>

      {/* Server result */}
      {result && (
        <>
          {result.error && !result.verification && (
            <p className="mt-3 text-sm text-red-600 font-medium">❌ {result.error}</p>
          )}
          {result.verification && (
            <VerificationResult
              data={result.verification}
              disclaimer={result.disclaimer}
            />
          )}
        </>
      )}

      {/* Disclaimer footer */}
      <p className="mt-2 text-xs text-gray-400 italic">
        ⚠️ AI-assisted visual assessment only. Not a laboratory certification.
      </p>
    </div>
  );
}
