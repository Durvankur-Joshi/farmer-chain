import React, { useState } from "react";
import axios from "axios";
import { useRefresh } from "../../context/useRefresh";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const UNIT_OPTIONS = ["kg", "quintal", "caret", "piece", "acre", "ton", "litre", "dozen"];
const CATEGORY_OPTIONS = [
  "Cereal", "Pulse", "Oilseed", "Vegetable", "Fruit",
  "Spice", "Fibre", "Sugar", "Plantation", "Other",
];

const STEPS = [
  { key: "creating", label: "Creating record", icon: "📝" },
  { key: "uploading", label: "Uploading image", icon: "📤" },
  { key: "verifying", label: "AI assessment", icon: "🔬" },
  { key: "done", label: "Ready", icon: "✓" },
];

function ProgressStepper({ currentStep, failed }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-1.5 flex-wrap p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
      {STEPS.map((step, i) => {
        const isActive = step.key === currentStep;
        const isDone = i < currentIdx || currentStep === "done";
        const isFailed = isActive && failed;
        return (
          <div key={step.key} className="flex items-center gap-1.5">
            {i > 0 && (
              <div className={`w-3 sm:w-5 h-0.5 ${isDone ? "bg-emerald-500" : "bg-slate-200"}`} />
            )}
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                isFailed
                  ? "bg-rose-50 text-rose-700 border-rose-300"
                  : isDone
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : isActive
                  ? "bg-emerald-600 text-white border-emerald-600 animate-pulse"
                  : "bg-white text-slate-400 border-slate-200"
              }`}
            >
              <span>{isFailed ? "❌" : isDone ? "✓" : isActive ? step.icon : "○"}</span>
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

    // Step 2: Upload crop image to IPFS + AI verification
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
          // Non-blocking
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

    return (
      <div className="space-y-4 py-1 animate-fade-in">
        <ProgressStepper currentStep="done" />

        <Alert variant="success" className="border-emerald-200 bg-emerald-50/90">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <AlertTitle className="text-emerald-950 font-bold">
            Crop Registered & Verified Successfully!
          </AlertTitle>
          <AlertDescription className="text-emerald-800 text-xs">
            AI quality verification is complete. Your crop record is active and ready for FPO bids.
          </AlertDescription>
        </Alert>

        {/* Compact Result Summary */}
        <div className="flex flex-col sm:flex-row gap-3.5 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          {(v.image_gateway_url || filePreview) && (
            <img
              src={v.image_gateway_url || filePreview}
              alt={c.crop_name}
              className="w-full sm:w-32 h-28 object-cover rounded-lg border border-slate-200 shrink-0"
            />
          )}

          <div className="space-y-2 min-w-0 flex-1 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-extrabold text-slate-900 text-sm">{c.crop_name}</h4>
              <Badge variant="outline" className="text-[10px]">{c.crop_category}</Badge>
              {v.quality_grade && (
                <Badge variant="success" className="text-[10px]">
                  Grade {v.quality_grade}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div>
                <span className="text-slate-400 block font-medium">Quantity</span>
                <span className="font-bold text-slate-900 font-mono">{c.quantity} {c.unit}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Quality Score</span>
                <span className="font-bold text-emerald-800 font-mono">{v.quality_score ?? "N/A"} / 100</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Detected Produce</span>
                <span className="font-semibold text-slate-800">{v.crop_detected || "Verified"}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Location</span>
                <span className="font-semibold text-slate-800 truncate block">{c.location || "Farm"}</span>
              </div>
            </div>

            {v.image_gateway_url && (
              <div className="pt-1 text-[11px] truncate">
                <span className="text-slate-400">IPFS CID: </span>
                <a
                  href={v.image_gateway_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-emerald-700 hover:underline"
                >
                  {v.image_cid?.slice(0, 16)}...
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            size="sm"
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
          >
            + Add Another Crop
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => onSuccess && onSuccess()}
          >
            🌱 View in My Crops
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {step && step !== "done" && (
        <ProgressStepper currentStep={step} failed={!!error} />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Registration Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Crop Name & Category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Crop Name / Variety <span className="text-rose-500">*</span>
          </label>
          <input
            name="crop_name"
            value={form.crop_name}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-medium"
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
            className="w-full px-3 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all cursor-pointer font-medium"
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

      {/* Quantity, Unit & Location */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            className="w-full px-3 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono font-semibold"
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
            className="w-full px-3 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all cursor-pointer font-medium"
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
            Farm Location <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            name="location"
            type="text"
            value={form.location}
            onChange={handleChange}
            placeholder="e.g. Pune, Maharashtra"
            className="w-full px-3 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-medium"
            disabled={submitting}
          />
        </div>
      </div>

      {/* Cultivation Date & Harvest Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Cultivation Start Date <span className="text-rose-500">*</span>
          </label>
          <input
            name="cultivation_date"
            type="date"
            value={form.cultivation_date}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-medium"
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
            className="w-full px-3 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-medium"
            required
            disabled={submitting}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Description & Farm Notes <span className="text-slate-400 font-normal">(Optional)</span>
        </label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={2}
          className="w-full px-3 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none font-medium"
          placeholder="Seed variety, pesticide-free practices, organic soil management…"
          disabled={submitting}
        />
      </div>

      {/* Primary Crop Photo (for AI Verification) */}
      <div className="p-3 bg-emerald-50/40 border border-emerald-200/80 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
            <span>📸</span>
            <span>Harvest Photo for AI Verification <span className="text-rose-500">*</span></span>
          </span>
          <span className="text-[10px] text-emerald-700 font-medium">Auto-grades quality</span>
        </div>

        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileChange}
          className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
          disabled={submitting}
        />

        {filePreview && (
          <div className="flex items-center gap-3 pt-1">
            <div className="relative w-20 h-16 rounded-lg border border-emerald-300 overflow-hidden shadow-xs shrink-0">
              <img src={filePreview} alt="Crop Preview" className="w-full h-full object-cover" />
            </div>
            <div className="text-xs space-y-0.5 min-w-0">
              <span className="font-semibold text-slate-900 block truncate">{file?.name}</span>
              <span className="text-slate-500 text-[10px] block">
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

      {/* Supporting Documents */}
      <div className="space-y-1.5 pt-1">
        <label className="block text-xs font-semibold text-slate-700">
          Supporting Documents <span className="text-slate-400 font-normal">(Optional IPFS Evidence)</span>
        </label>
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
          multiple
          onChange={handleEvidenceChange}
          className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
          disabled={submitting}
        />
        {evidenceFiles.length > 0 && (
          <p className="text-[11px] text-slate-600">
            📎 {evidenceFiles.length} file(s) selected
          </p>
        )}
      </div>

      {/* Dialog Actions */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        )}

        <Button
          type="submit"
          size="sm"
          disabled={submitting}
        >
          <span>🌱</span>
          <span>{submitting ? "Verifying & Saving…" : "Save Crop Record"}</span>
        </Button>
      </div>
    </form>
  );
}
