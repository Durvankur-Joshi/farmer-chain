import React, { useState, useRef, useCallback } from "react";
import axios from "axios";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const GRADE_STYLES = {
  A: {
    badge: "text-emerald-800 bg-emerald-100 border-emerald-300",
    label: "Excellent Quality",
    color: "bg-emerald-500",
    glow: "shadow-emerald-500/10",
  },
  B: {
    badge: "text-blue-800 bg-blue-100 border-blue-300",
    label: "Good Commercial Quality",
    color: "bg-blue-500",
    glow: "shadow-blue-500/10",
  },
  C: {
    badge: "text-yellow-800 bg-yellow-100 border-yellow-300",
    label: "Fair / Acceptable Quality",
    color: "bg-yellow-500",
    glow: "shadow-yellow-500/10",
  },
  D: {
    badge: "text-orange-800 bg-orange-100 border-orange-300",
    label: "Low Grade Lot",
    color: "bg-orange-500",
    glow: "shadow-orange-500/10",
  },
  F: {
    badge: "text-rose-800 bg-rose-100 border-rose-300",
    label: "Defective / Rejected Lot",
    color: "bg-rose-500",
    glow: "shadow-rose-500/10",
  },
};

function ScoreBar({ score, color = "bg-emerald-500" }) {
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="w-full bg-slate-200 rounded-full h-2 mt-1.5 overflow-hidden">
      <div
        className={`${color} h-full rounded-full transition-all duration-700 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function VerificationResult({ data, disclaimer }) {
  const v = data;
  const gradeInfo = GRADE_STYLES[v.quality_grade] || {
    badge: "text-slate-800 bg-slate-100 border-slate-300",
    label: "Standard Quality",
    color: "bg-slate-500",
  };
  const isFailed = v.verification_status === "failed";
  const confidencePct = Math.round((v.confidence_score || 0) * 100);

  return (
    <div
      className={`rounded-2xl border p-5 mt-4 transition-all ${
        isFailed
          ? "border-rose-200 bg-rose-50/50"
          : "border-emerald-200/90 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/30 shadow-xs"
      }`}
    >
      {/* Result Card Header */}
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-emerald-100">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 ${
              isFailed ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
            }`}
          >
            <span>{isFailed ? "❌" : "✓"}</span>
            <span>{isFailed ? "Verification Inconclusive" : "AI VERIFICATION: ✓ Analysis Complete"}</span>
          </span>
        </div>
        {v.created_at && (
          <span className="text-[11px] text-slate-400 font-mono">
            {new Date(v.created_at).toLocaleString()}
          </span>
        )}
      </div>

      {isFailed ? (
        <div className="space-y-2">
          <p className="text-xs text-rose-700 font-semibold">
            AI verification could not be completed.
          </p>
          <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-rose-200">
            {v.failure_reason || "Unable to extract visual features from image. Please ensure sample is well-lit and retry."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Key Metrics Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Detected Crop */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Crop Detected
              </span>
              <p className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-1.5 truncate">
                <span>🌾</span>
                <span className="truncate">{v.crop_detected || "Identified Crop"}</span>
              </p>
            </div>

            {/* Quality Grade */}
            <div className={`p-3.5 rounded-xl border shadow-2xs ${gradeInfo.badge}`}>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Quality Grade
                </span>
                <span className="text-2xl font-black">{v.quality_grade}</span>
              </div>
              <p className="text-[11px] font-bold mt-0.5 truncate">{gradeInfo.label}</p>
            </div>

            {/* Quality Score & Confidence */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-700">
                  <span>Quality Score</span>
                  <span className="font-mono text-emerald-700">{v.quality_score} / 100</span>
                </div>
                <ScoreBar score={v.quality_score} color={gradeInfo.color} />
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                  <span>Confidence</span>
                  <span className="font-mono text-blue-700">{confidencePct}%</span>
                </div>
                <ScoreBar score={confidencePct} color="bg-blue-500" />
              </div>
            </div>
          </div>

          {/* Plant Health & Diagnostics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">
                Plant Health & Pathology
              </span>
              {v.disease_detected ? (
                <span className="text-rose-700 font-bold flex items-center gap-1">
                  <span>⚠️</span>
                  <span>{v.disease_name || "Disease Symptoms Detected"}</span>
                </span>
              ) : (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <span>✓</span>
                  <span>Clean — No Disease Symptoms Observed</span>
                </span>
              )}
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">
                Visible Defects
              </span>
              <span className="font-medium text-slate-700">
                {v.visible_defects || "None observed on harvest sample"}
              </span>
            </div>
          </div>

          {/* AI Inspection Notes */}
          {v.ai_summary && (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 text-xs text-slate-700 italic space-y-1">
              <span className="text-[10px] text-purple-700 font-bold uppercase tracking-wider block not-italic">
                🤖 Gemini Vision Agronomic Summary
              </span>
              <p>"{v.ai_summary}"</p>
            </div>
          )}

          {/* AI Verification Trust Badges */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              AI Analysis Trust Verification
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-emerald-800">
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200">
                ✓ Image analyzed
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200">
                ✓ Crop detected
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200">
                ✓ Quality assessed
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200">
                ✓ Disease screened
              </span>
            </div>
          </div>

          {/* IPFS Link */}
          {v.image_gateway_url && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400">Decentralized Evidence:</span>
              <a
                href={v.image_gateway_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline inline-flex items-center gap-1"
              >
                <span>🔗 Inspect Analyzed Image on IPFS</span>
                <span>→</span>
              </a>
            </div>
          )}
        </div>
      )}

      {disclaimer && (
        <p className="mt-3 text-[10px] text-slate-400 italic border-t border-slate-200/60 pt-2">
          ⚠️ {disclaimer}
        </p>
      )}
    </div>
  );
}

export default function AIVerification({ cropId, cropName }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [step, setStep] = useState("idle"); // "idle" | "uploading" | "analyzing" | "done" | "error"
  const [result, setResult] = useState(null);
  const [clientError, setClientErr] = useState("");
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef();

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
      setClientErr(`Invalid file format (${selected.type}). Please upload a JPEG, PNG, or WEBP image.`);
      return;
    }
    if (selected.size > MAX_BYTES) {
      setClientErr(`File size is ${(selected.size / 1048576).toFixed(1)} MB. Maximum allowed is 10 MB.`);
      return;
    }

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(selected);
  };

  const handleVerify = async () => {
    if (!file) return setClientErr("Please select or capture a crop harvest image first.");
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
        disclaimer: res.data.disclaimer,
        error: null,
      });
      setStep("done");
    } catch (err) {
      const serverErr =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "AI verification could not be completed. Please check your image and retry.";
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
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              AI Crop Verification
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
              Gemini Vision AI
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            AI-powered visual assessment of your crop
          </p>
        </div>

        <button
          type="button"
          onClick={showHistory ? () => setShowHistory(false) : loadHistory}
          className="text-xs text-purple-700 hover:text-purple-900 font-bold cursor-pointer self-start sm:self-auto shrink-0"
        >
          {showHistory ? "✕ Hide History" : "📋 Assessment History"}
        </button>
      </div>

      {/* Assessment History Dropdown */}
      {showHistory && (
        <div className="space-y-3 animate-fade-in">
          <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Past Quality Inspections ({history?.length || 0})
          </h5>
          {!history || history.length === 0 ? (
            <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-100">
              No historical AI assessments recorded for this crop yet.
            </p>
          ) : (
            history.map((v) => (
              <VerificationResult key={v.id} data={v} disclaimer={null} />
            ))
          )}
        </div>
      )}

      {/* Studio Image Inspection Container */}
      <div className="bg-gradient-to-r from-purple-50/40 via-white to-purple-50/30 border border-purple-200/80 rounded-2xl p-5 space-y-4 shadow-2xs">
        {/* Preview or Upload Placeholder */}
        {preview ? (
          <div className="relative w-full max-w-sm mx-auto">
            <img
              src={preview}
              alt="Harvest sample preview"
              className="rounded-2xl border border-purple-200 w-full object-cover max-h-56 shadow-md"
            />
            <button
              type="button"
              onClick={reset}
              disabled={isRunning}
              className="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-900 text-white text-xs rounded-full w-7 h-7 flex items-center justify-center cursor-pointer shadow-md transition-all"
              title="Remove sample"
            >
              ✕
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-purple-200 hover:border-purple-400 bg-white/80 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center text-2xl mx-auto group-hover:scale-105 transition-transform">
              📸
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                Upload a crop image to begin verification.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Supports JPEG, PNG, WEBP up to 10 MB
              </p>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={isRunning}
          className="hidden"
        />

        {clientError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <span>⚠️</span>
            <span>{clientError}</span>
          </div>
        )}

        {/* Loading State Animation */}
        {isRunning && (
          <div className="p-4 rounded-xl bg-purple-100/60 border border-purple-300 text-center space-y-2 animate-fade-in">
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-purple-700 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-extrabold text-purple-900">
                AI is analyzing your crop...
              </span>
            </div>
            <p className="text-[11px] text-purple-700">
              {step === "uploading"
                ? "Securing sample on decentralized IPFS storage…"
                : "Inspecting crop geometry, color uniformity, and health diagnostics…"}
            </p>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleVerify}
            disabled={!file || isRunning || !!clientError}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-purple-900/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer flex-1"
          >
            <span>🔬</span>
            <span>
              {isRunning
                ? "Analyzing..."
                : result?.verification
                ? "Verification Complete"
                : step === "error"
                ? "Try Again"
                : "Verify Crop"}
            </span>
          </button>

          {file && !isRunning && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              Change Image
            </button>
          )}
        </div>
      </div>

      {/* Verification Result Output */}
      {result && (
        <div className="animate-fade-in">
          {result.error && !result.verification && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <span>❌</span>
                <span>AI verification could not be completed.</span>
              </p>
              <p className="text-slate-600 font-mono text-[11px]">{result.error}</p>
            </div>
          )}

          {result.verification && (
            <VerificationResult
              data={result.verification}
              disclaimer={result.disclaimer}
            />
          )}
        </div>
      )}
    </div>
  );
}
