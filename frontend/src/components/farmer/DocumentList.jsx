/**
 * DocumentList.jsx — Phase 2.3 + UI Modernization
 * Displays all IPFS documents attached to a CropPassport with AddressCopy & modern styles.
 */
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import AddressCopy from "../common/AddressCopy";

const DOC_TYPE_LABELS = {
  crop_image:       "🌾 Crop Image",
  soil_report:      "🧪 Soil Report",
  quality_report:   "📊 Quality Report",
  certification:    "🏆 Certification",
  harvest_document: "📋 Harvest Document",
  other:            "📁 Evidence Document",
};

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DocumentList({ cropId, refreshTrigger }) {
  const [docs, setDocs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [deleting, setDeleting] = useState(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(
        `/api/farmer/crops/${cropId}/documents/list/`,
        { withCredentials: true }
      );
      setDocs(res.data);
    } catch (err) {
      if (err.response?.status !== 403) {
        setError("Could not load documents.");
      }
    } finally {
      setLoading(false);
    }
  }, [cropId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs, refreshTrigger]);

  const handleDelete = async (docId) => {
    if (!window.confirm("Delete this document record? (IPFS content will remain immutable on decentralized network.)")) return;
    setDeleting(docId);
    try {
      await axios.delete(
        `/api/farmer/crops/${cropId}/documents/${docId}/`,
        { withCredentials: true }
      );
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      alert("Failed to delete document. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return <p className="text-xs text-slate-400 animate-pulse mt-2">Loading documents…</p>;
  }

  if (error) {
    return <p className="text-xs text-rose-500 mt-2">⚠️ {error}</p>;
  }

  if (docs.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic mt-2">
        No documents uploaded yet. Upload crop evidence above.
      </p>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div className="space-y-0.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">
                {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">({formatSize(doc.file_size)})</span>
            </div>
            <p className="text-slate-500 truncate font-mono text-[11px]">{doc.file_name}</p>
            <div className="pt-0.5">
              <AddressCopy value={doc.ipfs_cid} truncate={true} />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={doc.gateway_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg transition-all"
            >
              View IPFS
            </a>
            <button
              onClick={() => handleDelete(doc.id)}
              disabled={deleting === doc.id}
              className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {deleting === doc.id ? "…" : "🗑 Delete"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
