import React, { useState } from "react";
import axios from "axios";
import { useRefresh } from "../../context/useRefresh";

const UNIT_OPTIONS = ["kg", "quintal", "caret", "piece", "acre", "ton", "litre", "dozen"];
const CATEGORY_OPTIONS = [
  "Cereal", "Pulse", "Oilseed", "Vegetable", "Fruit",
  "Spice", "Fibre", "Sugar", "Plantation", "Other",
];

const STEPS = [
  { key: "creating", label: "Creating crop passport", icon: "📝" },
  { key: "uploading", label: "Uploading crop image to IPFS", icon: "📤" },
  { key: "verifying", label: "Running AI verification", icon: "🔬" },
  { key: "done", label: "Passport ready", icon: "✓" },
];

function ProgressStepper({ currentStep, failed }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {STEPS.map((step, i) => {
        const isActive = step.key === currentStep;
        const isDone = i < currentIdx || currentStep === "done";
        const isFailed = isActive && failed;
        return (
          <div key={step.key} className="flex items-center gap-1.5">
            {i > 0 && (
              <div className={`w-5 h-px ${isDone ? "bg-emerald-400" : "bg-slate-200"}`} />
            )}
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                isFailed
                  ? "bg-rose-50 text-rose-700 border-rose-300"
                  : isDone
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : isActive
                  ? "bg-purple-50 text-purple-800 border-purple-300 animate-pulse"
                  : "bg-slate-50 text-slate-400 border-slate-200"
              }`}
            >
              <span className="text-xs">
                {isFailed ? "❌" : isDone ? "✓" : isActive ? step.icon : "○"}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CropPassportForm({ onSuccess, onCancel }) {
  const { refresh } = useRefresh();
  const [form, setForm] = useState({
    crop_name: "",
    crop_category: "",
    description: "",
    quantity: "",
    unit: "kg",
    location: "",
    cultivation_date: "",
    harvest_date: "",
  });

  // Primary crop image
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  // Optional evidence documents
  const [evidenceFiles, setEvidenceFiles] = useState([]);

  // Flow state
  const [step, setStep] = useState(null); // null | creating | uploading | verifying | done
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { crop, verification }
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setError("");
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target.result);
      reader.readAsDataURL(selected);
    }
  };

  const handleEvidenceChange = (e) => {
    const files = Array.from(e.target.files);
    setEvidenceFiles(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    // Validation
    if (!form.crop_name.trim()) return setError("Crop name is required.");
    if (!form.crop_category) return setError("Please select a crop category.");
    if (!form.quantity || Number(form.quantity) <= 0)
      return setError("Quantity must be a positive number.");
    if (!form.cultivation_date) return setError("Cultivation start date is required.");
    if (!form.harvest_date) return setError("Harvest completion date is required.");
    if (form.cultivation_date > form.harvest_date)
      return setError("Cultivation date cannot be after harvest date.");
    if (!file) return setError("Primary crop image is required. Please upload a crop photo.");

    setSubmitting(true);

    let cropId = null;
    let cropData = null;

    // Step 1: Create crop passport
    try {
      setStep("creating");
      const res = await axios.post("/api/farmer/crops/", form, { withCredentials: true });
      cropId = res.data.id;
      cropData = res.data;
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        JSON.stringify(err.response?.data) ||
        "Failed to create crop passport.";
      setError(msg);
      setStep(null);
      setSubmitting(false);
      return;
    }

    // Step 2: Upload crop image to IPFS + AI verification (single call to /verify/)
    setStep("uploading");
    let verificationData = null;
    try {
      setStep("verifying");
      const formData = new FormData();
      formData.append("file", file);
      const verifyRes = await axios.post(
        `/api/farmer/crops/${cropId}/verify/`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      verificationData = verifyRes.data.verification;
    } catch (verifyErr) {
      const verifyMsg =
        verifyErr.response?.data?.error ||
        verifyErr.response?.data?.detail ||
        "AI crop verification failed. Please upload a clearer crop image and try again.";
      setError(verifyMsg);
      setStep("verifying");
      setSubmitting(false);
      return;
    }

    // Step 3: Upload optional evidence documents (non-blocking)
    if (evidenceFiles.length > 0) {
      for (const evFile of evidenceFiles) {
        try {
          const evForm = new FormData();
          evForm.append("file", evFile);
          evForm.append("document_type", "other");
          evForm.append("description", "Supporting evidence uploaded during registration");
          await axios.post(
            `/api/farmer/crops/${cropId}/documents/`,
            evForm,
            {
              withCredentials: true,
              headers: { "Content-Type": "multipart/form-data" },
            }
          );
        } catch {
          // Evidence upload failure is non-blocking — farmer can add more later
        }
      }
    }

    // Done
    setStep("done");
    setResult({ crop: cropData, verification: verificationData });
    setSubmitting(false);
    refresh(["farmer", "quotes", "inventory"]);
  };

  // If registration + verification is done, show result card
  if (result) {
    const v = result.verification || {};
    const c = result.crop || {};
    const gradeColor =
      v.quality_grade === "A"
        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
        : v.quality_grade === "B"
        ? "bg-blue-100 text-blue-800 border-blue-300"
        : v.quality_grade === "C"
        ? "bg-amber-100 text-amber-800 border-amber-300"
        : "bg-rose-100 text-rose-800 border-rose-300";

    return (
      <div className="space-y-5 max-w-2xl">
        <ProgressStepper currentStep="done" />

        {/* Success Result Card */}
        <div className="bg-gradient-to-br from-emerald-50/60 via-white to-purple-50/30 border border-emerald-200 rounded-3xl p-5 sm:p-7 space-y-5 shadow-xs">
          <div className="flex items-center gap-3 pb-3 border-b border-emerald-100">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-lg shadow-md shadow-emerald-500/20">
              ✓
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Crop Passport Registered & Verified
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                AI verification complete — passport is ready for NFT minting.
              </p>
            </div>
          </div>

          {/* Crop Image + Details */}
          <div className="flex flex-col sm:flex-row gap-4">
            {(v.image_gateway_url || filePreview) && (
              <img
                src={v.image_gateway_url || filePreview}
                alt={c.crop_name}
                className="w-full sm:w-40 h-32 object-cover rounded-2xl border border-emerald-200 shadow-sm shrink-0"
              />
            )}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-extrabold text-slate-900">
                  {c.crop_name}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                  {c.crop_category}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Quantity</span>
                  <span className="font-extrabold text-slate-900 font-mono">
                    {c.quantity} {c.unit}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Harvest Date</span>
                  <span className="font-semibold text-slate-800">{c.harvest_date}</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Assessment Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                🤖 Gemini Vision AI Assessment
              </span>
              <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${gradeColor}`}>
                Grade {v.quality_grade}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Crop Detected</span>
                <span className="font-bold text-slate-800">{v.crop_detected}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Quality Score</span>
                <span className="font-extrabold font-mono text-emerald-700">
                  {v.quality_score} / 100
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Confidence</span>
                <span className="font-bold font-mono text-blue-700">
                  {Math.round((v.confidence_score || 0) * 100)}%
                </span>
              </div>
            </div>
            {v.ai_summary && (
              <p className="text-xs text-slate-600 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                "{v.ai_summary}"
              </p>
            )}
          </div>

          {/* IPFS CID Link */}
          {v.image_cid && (
            <div className="flex items-center gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-500">IPFS:</span>
              <a
                href={v.image_gateway_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:text-blue-800 transition-colors truncate"
              >
                {v.image_cid}
              </a>
            </div>
          )}

          {/* Evidence documents note */}
          {evidenceFiles.length > 0 && (
            <div className="text-xs text-slate-500 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
              📦 {evidenceFiles.length} optional evidence document(s) uploaded.
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-emerald-100">
            <button
              type="button"
              onClick={() => onSuccess && onSuccess()}
              className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-900/20 cursor-pointer flex items-center gap-2"
            >
              <span>🪙</span>
              <span>View Passport & Mint NFT</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setStep(null);
                setFile(null);
                setFilePreview(null);
                setEvidenceFiles([]);
                setForm({
                  crop_name: "",
                  crop_category: "",
                  description: "",
                  quantity: "",
                  unit: "kg",
                  location: "",
                  cultivation_date: "",
                  harvest_date: "",
                });
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Register Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {step && <ProgressStepper currentStep={step} failed={!!error && step !== null} />}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 text-xs font-medium flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-lg shadow-md shadow-emerald-500/20">
            🌾
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Register Digital Crop Passport</h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Create a blockchain-backed digital twin for your crop lot.
            </p>
          </div>
        </div>

        {/* Section 1: Crop Lot Information */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
            <span className="text-sm">🌾</span>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Crop Lot Information
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Crop / Lot Name <span className="text-rose-500">*</span>
              </label>
              <input
                name="crop_name"
                value={form.crop_name}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-medium"
                placeholder="e.g. Organic Sharbati Wheat (Grade A)"
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                name="crop_category"
                value={form.crop_category}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all cursor-pointer font-medium"
                required
                disabled={submitting}
              >
                <option value="">Select Category</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description & Agronomic Notes
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all resize-none font-medium"
              placeholder="Seed variety, pesticide-free practices, organic farm details…"
              disabled={submitting}
            />
          </div>
        </div>

        {/* Section 2: Batch Quantity & Location */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
            <span className="text-sm">⚖️</span>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              2. Yield & Batch Specifications
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lot Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                name="quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={form.quantity}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-mono font-semibold"
                placeholder="e.g. 500"
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit <span className="text-rose-500">*</span>
              </label>
              <select
                name="unit"
                value={form.unit}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all cursor-pointer font-medium"
                required
                disabled={submitting}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Farm Location
              </label>
              <input
                name="location"
                type="text"
                value={form.location}
                onChange={handleChange}
                placeholder="e.g. Pune, Maharashtra"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-medium"
                disabled={submitting}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Cultivation Timeline */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
            <span className="text-sm">📅</span>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              3. Cultivation & Harvest Timeline
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cultivation Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                name="cultivation_date"
                type="date"
                value={form.cultivation_date}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-medium"
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Harvest Completion Date <span className="text-rose-500">*</span>
              </label>
              <input
                name="harvest_date"
                type="date"
                value={form.harvest_date}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-medium"
                required
                disabled={submitting}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Primary Crop Image (REQUIRED) */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
            <span className="text-sm">📸</span>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              4. Primary Crop Image <span className="text-rose-500">*</span>
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            Upload ONE clear crop harvest photo. This image is uploaded to IPFS and automatically verified by Gemini Vision AI during registration.
          </p>

          <div className="space-y-2">
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
              disabled={submitting}
            />

            {filePreview && (
              <div className="mt-2 relative w-40 h-28 rounded-xl border border-purple-200 overflow-hidden shadow-xs">
                <img src={filePreview} alt="Primary Crop Preview" className="w-full h-full object-cover" />
                <span className="absolute bottom-1 right-1 text-[9px] bg-slate-900/80 text-white font-bold px-1.5 py-0.5 rounded">
                  Primary Image
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Optional Evidence Documents */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
            <span className="text-sm">📦</span>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              5. Optional Evidence
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            Upload certificates, soil reports, quality reports, harvest records, or other supporting documents. This is optional.
          </p>

          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
            multiple
            onChange={handleEvidenceChange}
            className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            disabled={submitting}
          />

          {evidenceFiles.length > 0 && (
            <div className="text-xs text-slate-600 bg-blue-50/60 p-2 rounded-lg border border-blue-100">
              📎 {evidenceFiles.length} file(s) selected: {evidenceFiles.map((f) => f.name).join(", ")}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-900/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <span>🌾</span>
            <span>{submitting ? "Registering…" : "Register Crop Passport"}</span>
          </button>
          {onCancel && !submitting && (
            <button
              type="button"
              onClick={onCancel}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
