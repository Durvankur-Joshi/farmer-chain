/**
 * AIVerification.jsx — Phase 2.4 + UI Modernization
 * Modernized AI Crop Quality Verification panel.
 */
import React, { useState, useRef, useCallback } from "react";
import axios from "axios";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES     = 10 * 1024 * 1024; // 10 MB

const GRADE_COLORS = {
  A: "text-emerald-700 bg-emerald-100 border-emerald-300",
  B: "text-blue-700 bg-blue-100 border-blue-300",
  C: "text-yellow-700 bg-yellow-100 border-yellow-300",
  D: "text-orange-700 bg-orange-100 border-orange-300",
  F: "text-rose-700 bg-rose-100 border-rose-300",
};

const GRADE_LABELS = {
  A: "Excellent Quality",
  B: "Good Quality",
  C: "Fair / Acceptable",
  D: "Low Grade",
  F: "Defective / Reject",
};

function ScoreBar({ score, color = "bg-emerald-500" }) {
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="w-full bg-slate-200/80 rounded-full h-2 mt-1 overflow-hidden">
      <div
        className={`${color} h-full rounded-full transition-all duration-700`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function VerificationResult({ data, disclaimer }) {
  const v = data;
  const gradeClass = GRADE_COLORS[v.quality_grade] || "text-slate-700 bg-slate-100 border-slate-300";
  const isFailed   = v.verification_status === "failed";

  return (
    <div className={`rounded-2xl border p-4 mt-3 ${isFailed ? "border-rose-200 bg-rose-50/50" : "border-emerald-200 bg-emerald-50/40"}`}>
      <div className="flex justify-between items-center mb-3">
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isFailed ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
          {isFailed ? "❌ Verification Failed" : "✅ Gemini AI Verified"}
        </span>
        <span className="text-[11px] text-slate-400 font-mono">{new Date(v.created_at).toLocaleString()}</span>
      </div>

      {isFailed ? (
        <p className="text-xs text-rose-700 font-medium">{v.failure_reason || "Verification could not be completed."}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-4 items-center flex-wrap">
            <div className={`border rounded-2xl p-3 text-center min-w-[90px] ${gradeClass}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Grade</p>
              <p className="text-3xl font-extrabold">{v.quality_grade}</p>
              <p className="text-[10px] font-semibold">{GRADE_LABELS[v.quality_grade] || ""}</p>
            </div>

            <div className="flex-1 min-w-[180px] space-y-2">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Quality Score</span>
                  <span>{v.quality_score} / 100</span>
                </div>
                <ScoreBar score={v.quality_score} color="bg-emerald-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>AI Confidence</span>
                  <span>{Math.round(v.confidence_score * 100)}%</span>
                </div>
                <ScoreBar score={v.confidence_score * 100} color="bg-blue-500" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
            <div>
              <span className="text-slate-400 font-semibold">Crop Detected: </span>
              <span className="text-slate-800 font-medium">{v.crop_detected || "—"}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">Disease Status: </span>
              {v.disease_detected ? (
                <span className="text-rose-700 font-bold">⚠️ {v.disease_name || "Detected"}</span>
              ) : (
                <span className="text-emerald-700 font-bold">✓ Not detected</span>
              )}
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 font-semibold">Defects: </span>
              <span className="text-slate-700">{v.visible_defects || "None observed"}</span>
            </div>
          </div>

          {v.ai_summary && (
            <div className="bg-white/80 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-700 italic">
              "{v.ai_summary}"
            </div>
          )}

          {v.image_gateway_url && (
            <a
              href={v.image_gateway_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-700 hover:underline font-medium inline-block"
            >
              🔗 View verified image on IPFS →
            </a>
          )}
        </div>
      )}

      {disclaimer && (
        <p className="mt-3 text-[11px] text-slate-400 italic border-t border-slate-200/80 pt-2">
          ⚠️ {disclaimer}
        </p>
      )}
    </div>
  );
}

export default function AIVerification({ cropId, cropName }) {
  const [file, setFile]             = useState(null);
  const [preview, setPreview]       = useState(null);
  const [step, setStep]             = useState("idle");
  const [result, setResult]         = useState(null);
  const [clientError, setClientErr] = useState("");
  const [history, setHistory]       = useState(null);
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
      setClientErr(`Invalid file type "${selected.type}". Upload a JPEG, PNG, or WEBP image.`);
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
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🤖</span>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            AI Crop Quality Assessment
          </h4>
        </div>
        <button
          onClick={showHistory ? () => setShowHistory(false) : loadHistory}
          className="text-xs text-purple-600 hover:text-purple-800 font-semibold cursor-pointer"
        >
          {showHistory ? "✕ Hide History" : "📋 Assessment History"}
        </button>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="mb-4 space-y-2">
          {!history || history.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No past verifications recorded.</p>
          ) : (
            history.map((v) => (
              <VerificationResult key={v.id} data={v} disclaimer={null} />
            ))
          )}
        </div>
      )}

      {/* File picker */}
      <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4">
        <p className="text-xs text-slate-600 mb-3">
          Upload harvest sample image. Gemini Vision AI analyzes grading, maturity, and disease indicators before pinning evidence to IPFS.
        </p>

        {preview && (
          <div className="mb-3 relative w-full max-w-xs">
            <img
              src={preview}
              alt="Crop preview"
              className="rounded-xl border border-slate-200 w-full object-cover max-h-48 shadow-2xs"
            />
            <button
              onClick={reset}
              className="absolute top-2 right-2 bg-slate-900/80 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center hover:bg-slate-900 cursor-pointer"
              title="Remove image"
            >
              ✕
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={isRunning}
          className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 mb-3 cursor-pointer"
        />

        {clientError && (
          <p className="text-xs text-rose-600 font-medium mb-3">⚠️ {clientError}</p>
        )}

        {isRunning && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-purple-700 font-semibold">
              {step === "uploading" ? "Uploading image to IPFS…" : "Analyzing visual features with Gemini Vision AI…"}
            </span>
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={!file || isRunning || !!clientError}
          className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs disabled:opacity-50 w-full flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>🔬</span>
          <span>{isRunning ? "Analyzing Quality…" : "Verify Crop Quality with Gemini AI"}</span>
        </button>
      </div>

      {result && (
        <>
          {result.error && !result.verification && (
            <p className="mt-3 text-xs text-rose-600 font-medium">❌ {result.error}</p>
          )}
          {result.verification && (
            <VerificationResult
              data={result.verification}
              disclaimer={result.disclaimer}
            />
          )}
        </>
      )}
    </div>
  );
}
