/**
 * DocumentUploader.jsx — Phase 2.3
 *
 * Handles the complete IPFS document upload flow:
 *  1. Farmer selects a file (JPG/PNG/WEBP/PDF, max 10 MB)
 *  2. Farmer chooses a document type
 *  3. File is sent to Django backend as multipart/form-data
 *  4. Backend uploads to Pinata and returns the CID
 *  5. Parent is notified to refresh the document list
 *
 * Security: File goes to Django, not directly to Pinata.
 * Pinata JWT never appears in this file or in VITE_ env vars.
 */
import React, { useState, useRef } from "react";
import axios from "axios";

const DOCUMENT_TYPES = [
  { value: "crop_image",       label: "🌾 Crop Image" },
  { value: "soil_report",      label: "🧪 Soil Report" },
  { value: "quality_report",   label: "📊 Quality Report" },
  { value: "certification",    label: "🏆 Certification" },
  { value: "harvest_document", label: "📋 Harvest Document" },
  { value: "other",            label: "📁 Other" },
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

    // Client-side size check
    if (selected.size > MAX_BYTES) {
      setError(`File too large (${formatSize(selected.size)}). Maximum is 10 MB.`);
      setFile(null);
      return;
    }

    // Client-side extension check
    const ext = "." + selected.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setError(`File type "${ext}" is not allowed. Allowed: JPG, PNG, WEBP, PDF.`);
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

      setSuccess(`✅ "${file.name}" uploaded to IPFS successfully!`);
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
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
      <h4 className="text-sm font-bold text-blue-800 mb-3">📤 Upload Evidence to IPFS</h4>

      <div className="space-y-3">
        {/* Document type selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Document Type
          </label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={uploading}
          >
            {DOCUMENT_TYPES.map((dt) => (
              <option key={dt.value} value={dt.value}>{dt.label}</option>
            ))}
          </select>
        </div>

        {/* File picker */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            File <span className="font-normal text-gray-400">(JPG, PNG, WEBP, PDF · max 10 MB)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={handleFileChange}
            disabled={uploading}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
          />
          {file && (
            <p className="mt-1 text-xs text-gray-500">
              Selected: <span className="font-semibold">{file.name}</span> ({formatSize(file.size)})
            </p>
          )}
        </div>

        {/* Upload progress bar */}
        {uploading && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
            <p className="text-xs text-blue-600 mt-1">Uploading… {progress}%</p>
          </div>
        )}

        {/* Error / success messages */}
        {error && (
          <p className="text-xs text-red-600 font-medium">❌ {error}</p>
        )}
        {success && (
          <p className="text-xs text-green-600 font-medium">{success}</p>
        )}

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
        >
          {uploading ? "⏳ Uploading…" : "📤 Upload to IPFS"}
        </button>
      </div>
    </div>
  );
}
