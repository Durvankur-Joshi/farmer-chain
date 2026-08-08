/**
 * DocumentList.jsx — Phase 2.3
 *
 * Displays all IPFS documents attached to a CropPassport.
 * Each row shows: document type, file name, CID, View link, Copy CID button, Delete button.
 *
 * Fetches from GET /api/farmer/crops/<cropId>/documents/list/
 * Deletes via DELETE /api/farmer/crops/<cropId>/documents/<id>/
 */
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

const DOC_TYPE_LABELS = {
  crop_image:       "🌾 Crop Image",
  soil_report:      "🧪 Soil Report",
  quality_report:   "📊 Quality Report",
  certification:    "🏆 Certification",
  harvest_document: "📋 Harvest Document",
  other:            "📁 Other",
};

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function cidShort(cid) {
  if (!cid) return "—";
  if (cid.length <= 16) return cid;
  return cid.slice(0, 8) + "…" + cid.slice(-6);
}

export default function DocumentList({ cropId, refreshTrigger }) {
  const [docs, setDocs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [copied, setCopied]   = useState("");
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

  const handleCopy = (cid) => {
    navigator.clipboard.writeText(cid).then(() => {
      setCopied(cid);
      setTimeout(() => setCopied(""), 2000);
    });
  };

  const handleDelete = async (docId) => {
    if (!window.confirm("Delete this document record? (IPFS content may remain accessible via public gateways.)")) return;
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
    return <p className="text-xs text-gray-400 animate-pulse mt-2">Loading documents…</p>;
  }

  if (error) {
    return <p className="text-xs text-red-500 mt-2">⚠️ {error}</p>;
  }

  if (docs.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic mt-2">
        No documents uploaded yet. Upload crop evidence above.
      </p>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2"
        >
          {/* Left: type + filename */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-700 truncate">
              {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
            </p>
            <p className="text-xs text-gray-500 truncate">{doc.file_name}</p>
            <p className="text-xs text-gray-400">{formatSize(doc.file_size)}</p>
          </div>

          {/* CID */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-mono truncate" title={doc.ipfs_cid}>
              CID: {cidShort(doc.ipfs_cid)}
            </p>
            <p className="text-xs text-gray-400">{doc.ipfs_uri}</p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-1 shrink-0">
            <a
              href={doc.gateway_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
            >
              🔗 View
            </a>
            <button
              onClick={() => handleCopy(doc.ipfs_cid)}
              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
            >
              {copied === doc.ipfs_cid ? "✅ Copied!" : "📋 Copy CID"}
            </button>
            <button
              onClick={() => handleDelete(doc.id)}
              disabled={deleting === doc.id}
              className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 disabled:opacity-50"
            >
              {deleting === doc.id ? "…" : "🗑 Delete"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
