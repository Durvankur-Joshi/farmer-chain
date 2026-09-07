import React, { useState } from "react";
import axios from "axios";
import { useRefresh } from "../../context/useRefresh";

const UNIT_OPTIONS = ["kg", "quintal", "caret", "piece", "acre", "ton", "litre", "dozen"];
const CATEGORY_OPTIONS = [
  "Cereal", "Pulse", "Oilseed", "Vegetable", "Fruit",
  "Spice", "Fibre", "Sugar", "Plantation", "Other",
];

const STEPS = [
  { key: "creating", label: "Creating crop record", icon: "📝" },
  { key: "uploading", label: "Uploading image to IPFS", icon: "📤" },
  { key: "verifying", label: "AI quality assessment", icon: "🔬" },
  { key: "done", label: "Crop record ready", icon: "✓" },
];

function ProgressStepper({ currentStep, failed }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-1.5 flex-wrap p-3 bg-slate-50 border border-slate-200 rounded-2xl">
      {STEPS.map((step, i) => {
        const isActive = step.key === currentStep;
        const isDone = i < currentIdx || currentStep === "done";
        const isFailed = isActive && failed;
        return (
          <div key={step.key} className="flex items-center gap-1.5">
            {i > 0 && (
              <div className={`w-4 sm:w-6 h-0.5 ${isDone ? "bg-emerald-500" : "bg-slate-200"}`} />
            )}
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                isFailed
                  ? "bg-rose-50 text-rose-700 border-rose-300"
                  : isDone
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : isActive
                  ? "bg-emerald-600 text-white border-emerald-600 animate-pulse"
                  : "bg-white text-slate-400 border-slate-200"
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

  const handleRemoveFile = () => {
    setFile(null);
    setFilePreview(null);
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
    if (!file) return setError("Primary crop image is required. Please upload a clear crop photo.");

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
        "Failed to create crop record.";
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

  // ── Success View ────────────────────────────────────────────────
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
      <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
        <ProgressStepper currentStep="done" />

        {/* Success Card */}
        <div className="bg-white border border-emerald-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-3.5 pb-4 border-b border-emerald-100">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-xl text-white shadow-md shadow-emerald-600/20 shrink-0">
              ✓
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Crop Registered & Verified Successfully!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                AI quality verification is complete. Your crop is recorded and ready for FPO procurement offers.
              </p>
            </div>
          </div>

          {/* Crop Image + Details */}
          <div className="flex flex-col sm:flex-row gap-5">
            {(v.image_gateway_url || filePreview) && (
              <img
                src={v.image_gateway_url || filePreview}
                alt={c.crop_name}
                className="w-full sm:w-48 h-40 object-cover rounded-2xl border border-emerald-200 shadow-xs shrink-0"
              />
            )}
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-extrabold text-slate-900">
                  {c.crop_name}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {c.crop_category}
                </span>
                {v.quality_grade && (
                  <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${gradeColor}`}>
                    Grade {v.quality_grade}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs pt-1">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Quantity</span>
                  <span className="font-extrabold text-slate-800 font-mono mt-0.5 block">
                    {c.quantity} {c.unit}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">AI Score</span>
                  <span className="font-extrabold text-emerald-700 font-mono mt-0.5 block">
                    {v.quality_score ? `${v.quality_score} / 100` : "Verified"}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Location</span>
                  <span className="font-medium text-slate-700 mt-0.5 block truncate">
                    {c.location || "Farm Field"}
                  </span>
                </div>
              </div>

              {v.ai_summary && (
                <p className="text-xs text-slate-600 italic bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/60">
                  "{v.ai_summary}"
                </p>
              )}
            </div>
          </div>

          {/* IPFS CID Link */}
          {v.image_cid && (
            <div className="flex items-center gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-500">IPFS CID:</span>
              <a
                href={v.image_gateway_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-emerald-700 hover:text-emerald-900 transition-colors truncate"
              >
                {v.image_cid}
              </a>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 flex-wrap">
            <button
              type="button"
              onClick={() => onSuccess && onSuccess()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>🌱</span>
              <span>View in My Crops</span>
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
              + Add Another Crop
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Guidance Box for Low-Literacy Farmer Understanding */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌱</span>
          <h3 className="text-sm font-extrabold text-emerald-950 tracking-tight">
            How to Record Your Crop
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white/90 p-3 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="font-extrabold text-emerald-800 block text-[10px] uppercase tracking-wider">
              1. WHAT?
            </span>
            <p className="text-slate-700 mt-1 font-medium leading-relaxed">
              Add your crop details and upload a clear photo of your harvest.
            </p>
          </div>
          <div className="bg-white/90 p-3 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="font-extrabold text-emerald-800 block text-[10px] uppercase tracking-wider">
              2. WHY?
            </span>
            <p className="text-slate-700 mt-1 font-medium leading-relaxed">
              AI checks your crop photo for authenticity, category match, and quality grade.
            </p>
          </div>
          <div className="bg-white/90 p-3 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="font-extrabold text-emerald-800 block text-[10px] uppercase tracking-wider">
              3. WHAT HAPPENS NEXT?
            </span>
            <p className="text-slate-700 mt-1 font-medium leading-relaxed">
              Your verified crop record can be offered directly to buyers and FPOs.
            </p>
          </div>
        </div>
      </div>

      {/* Visual Step Progress Indicator */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900">
          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] shrink-0">1</span>
          <span className="truncate">Crop Details</span>
        </div>
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-xs font-bold text-emerald-900">
          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] shrink-0">2</span>
          <span className="truncate">Quantity & Dates</span>
        </div>
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-xs font-bold text-emerald-900">
          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] shrink-0">3</span>
          <span className="truncate">AI Verification</span>
        </div>
        <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-500">
          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] shrink-0">4</span>
          <span className="truncate">Your Crop Record</span>
        </div>
      </div>

      {step && <ProgressStepper currentStep={step} failed={!!error && step !== null} />}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 text-xs font-medium flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Form Container + Helpful Information Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: The Form */}
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌱</span>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Add Your Crop</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Create a secure digital record for your crop lot with instant AI quality assessment.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Crop Details */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🌾</span>
                  <span>Crop Details</span>
                </h3>
                <span className="text-[10px] font-semibold text-rose-600">* Required</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Crop Name / Variety <span className="text-rose-500">*</span>
                  </label>
                  <input
                    name="crop_name"
                    value={form.crop_name}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-medium"
                    placeholder="e.g. Organic Basmati Rice"
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
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all cursor-pointer font-medium"
                    required
                    disabled={submitting}
                  >
                    <option value="">Select Crop Category</option>
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Description & Farm Notes
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                </div>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none font-medium"
                  placeholder="Seed variety, pesticide-free practices, organic soil management…"
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Section 2: Quantity & Farm Details */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>⚖️</span>
                  <span>Quantity & Farm Details</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harvest Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    name="quantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.quantity}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono font-semibold"
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
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all cursor-pointer font-medium"
                    required
                    disabled={submitting}
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Farm Location
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                  </div>
                  <input
                    name="location"
                    type="text"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="e.g. Pune, Maharashtra"
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-medium"
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Cultivation & Harvest Dates */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📅</span>
                  <span>Cultivation & Harvest Dates</span>
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
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-medium"
                    required
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harvest Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    name="harvest_date"
                    type="date"
                    value={form.harvest_date}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-medium"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Crop Image (Required for AI Verification) */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📸</span>
                  <span>Crop Photo</span>
                  <span className="text-emerald-700 font-semibold text-[11px] normal-case">
                    (Used for AI Verification)
                  </span>
                </h3>
                <span className="text-[10px] font-semibold text-rose-600">* Required</span>
              </div>

              <div className="p-3.5 bg-emerald-50/50 border border-emerald-200/70 rounded-2xl space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Upload a clear photo of your harvested crop. Our AI automatically verifies the crop type and calculates a quality score.
                </p>

                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                    disabled={submitting}
                  />

                  {filePreview && (
                    <div className="flex items-center gap-3 pt-2">
                      <div className="relative w-32 h-24 rounded-xl border border-emerald-300 overflow-hidden shadow-xs shrink-0">
                        <img src={filePreview} alt="Crop Preview" className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 text-[9px] bg-slate-900/80 text-white font-bold px-1.5 py-0.5 rounded">
                          Preview
                        </span>
                      </div>
                      <div className="text-xs space-y-1 min-w-0">
                        <span className="font-bold text-slate-900 block truncate">
                          {file?.name}
                        </span>
                        <span className="text-slate-500 text-[11px] block">
                          {(file?.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="text-rose-600 hover:text-rose-700 font-semibold text-[11px] cursor-pointer"
                        >
                          ✕ Remove Photo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 5: Optional Supporting Documents */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📄</span>
                  <span>Supporting Documents</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">Optional</span>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Optionally attach lab certificates, organic farming proof, or soil health cards.
                </p>

                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                  multiple
                  onChange={handleEvidenceChange}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  disabled={submitting}
                />

                {evidenceFiles.length > 0 && (
                  <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    📎 {evidenceFiles.length} file(s) selected: {evidenceFiles.map((f) => f.name).join(", ")}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-7 py-3 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-700/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🌱</span>
                <span>{submitting ? "Saving & Verifying Photo…" : "Save Crop Record & Verify Photo"}</span>
              </button>

              {onCancel && !submitting && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Column: Helpful Information Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 pb-2 border-b border-emerald-200/60">
              <span className="text-base">💡</span>
              <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
                How it works
              </h4>
            </div>

            <ol className="space-y-3 text-xs text-slate-600 font-medium leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <strong className="text-slate-900 block">Add Crop Details</strong>
                  Enter your crop variety, harvest quantity, and cultivation dates.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <strong className="text-slate-900 block">Upload Clear Photo</strong>
                  Upload a photo of your harvest for decentralized IPFS storage.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <strong className="text-slate-900 block">AI Quality Assessment</strong>
                  Gemini Vision AI checks the crop and assigns an instant quality grade.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <div>
                  <strong className="text-slate-900 block">Secure Crop Record</strong>
                  Your verified crop passport is created and can be minted on Ethereum.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  5
                </span>
                <div>
                  <strong className="text-slate-900 block">Receive FPO Offers</strong>
                  FPO buyers can discover your harvest and submit purchase bids.
                </div>
              </li>
            </ol>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 space-y-2.5 text-xs shadow-2xs">
            <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
              <span>🌾</span>
              <span>Tips for Quality Grading</span>
            </h5>
            <ul className="space-y-1.5 text-slate-500 list-disc list-inside">
              <li>Take photo in bright daylight</li>
              <li>Keep the produce in clear focus</li>
              <li>Avoid heavy shadows or blurry angles</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
