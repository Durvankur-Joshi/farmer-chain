/**
 * DocumentUploader.jsx — Phase 2.3 + UI Modernization
 * Modernized IPFS document evidence uploader.
 */
import React, { useState, useRef } from "react";
import axios from "axios";

const DOCUMENT_TYPES = [
  { value: "crop_image",       label: "🌾 Crop Image / Visual Proof" },
  { value: "soil_report",      label: "🧪 Soil & Lab Nutrient Report" },
  { value: "quality_report",   label: "📊 Harvest Quality Audit" },
  { value: "certification",    label: "🏆 Organic / APEDA Certificate" },
  { value: "harvest_document", label: "📋 Mandi / Harvest Receipt" },
  { value: "other",            label: "📁 Other Supply Chain Evidence" },
];

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DocumentUploader({ cropId, onUploadSuccess }) {
  const [file, setFile]               = useState(null);
  const [docType, setDocType]         = useState("crop_image");
  const [uploading, setUploading]     = useState(false);
  const [progress, setProgress]       = useState(0);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");
  const fileInputRef                  = useRef();

  const handleFileChange = (e) => {
    setError("");
    setSuccess("");
    const selected = e.target.files[0];
    if (!selected) return;

    if (selected.size > MAX_BYTES) {
      setError(`File too large (${formatSize(selected.size)}). Max allowed is 10 MB.`);
      setFile(null);
      return;
    }

    const ext = "." + selected.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setError(`File type "${ext}" is not supported. Allowed: JPG, PNG, WEBP, PDF.`);
      setFile(null);
      return;
    }

    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return setError("Please select a file first.");
    setError("");
    setSuccess("");
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", docType);

    try {
      await axios.post(
        `/api/farmer/crops/${cropId}/documents/`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (evt) => {
            if (evt.total) {
              setProgress(Math.round((evt.loaded / evt.total) * 100));
            }
          },
        }
      );

      setSuccess(`✅ "${file.name}" pinned to IPFS successfully!`);
      setFile(null);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploadSuccess && onUploadSuccess();
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Upload failed. Please try again.";
      setError(msg);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
          Document Classification
        </label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-blue-500 outline-none cursor-pointer"
          disabled={uploading}
        >
          {DOCUMENT_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>{dt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
          Select Evidence File <span className="text-slate-400 font-normal">(JPG, PNG, WEBP, PDF · max 10 MB)</span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          onChange={handleFileChange}
          disabled={uploading}
          className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
        />
        {file && (
          <p className="mt-1 text-[11px] text-slate-500">
            Selected: <span className="font-semibold text-slate-800">{file.name}</span> ({formatSize(file.size)})
          </p>
        )}
      </div>

      {uploading && (
        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-500 h-full rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && <p className="text-xs text-rose-600 font-medium">⚠️ {error}</p>}
      {success && <p className="text-xs text-emerald-700 font-medium">{success}</p>}

      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <span>📤</span>
        <span>{uploading ? `Uploading to IPFS (${progress}%)…` : "Upload & Pin to IPFS"}</span>
      </button>
    </div>
  );
}
