/**
 * CropPassportPage.jsx — Phase 2.2 + 2.3
 * Public verification page. No authentication required.
 * Route: /crop-passport/:id
 *
 * Phase 2.3: Shows public IPFS documents section.
 * Never exposes: email, aadhaar, password, Pinata credentials.
 */
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

const DOC_TYPE_LABELS = {
  crop_image:       "🌾 Crop Image",
  soil_report:      "🧪 Soil Report",
  quality_report:   "📊 Quality Report",
  certification:    "🏆 Certification",
  harvest_document: "📋 Harvest Document",
  other:            "📁 Other",
};

function ipfsGateway(uri) {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`;
  }
  return uri;
}

function Row({ label, value, link }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 py-2 border-b border-gray-100 last:border-0">
      <span className="w-44 text-sm font-semibold text-gray-500 shrink-0">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 underline break-all"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-gray-800 break-all">{value || "—"}</span>
      )}
    </div>
  );
}

export default function CropPassportPage() {
  const { id } = useParams();
  const [crop, setCrop]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied]   = useState("");

  useEffect(() => {
    axios
      .get(`/api/farmer/crops/public/${id}/`)
      .then((res) => { setCrop(res.data); setLoading(false); })
      .catch((err) => {
        setLoading(false);
        if (err.response?.status === 404) setNotFound(true);
      });
  }, [id]);

  const handleCopyCid = (cid) => {
    navigator.clipboard.writeText(cid).then(() => {
      setCopied(cid);
      setTimeout(() => setCopied(""), 2000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading Crop Passport…</p>
      </div>
    );
  }

  if (notFound || !crop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-red-600">404 — Crop Passport Not Found</h1>
        <p className="text-gray-500">The requested Crop Passport does not exist.</p>
      </div>
    );
  }

  const isMinted  = crop.status === "minted";
  const documents = crop.documents || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-purple-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-lg border border-green-100 p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">🌾</span>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">
                FarmerChain Crop Passport
              </h1>
              <p className="text-sm text-gray-500">#{id} · {crop.crop_category}</p>
            </div>
          </div>
          <div
            className={`mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold w-fit ${
              isMinted
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {isMinted ? "✅ Verified on Ethereum Sepolia" : "⏳ Pending NFT Mint"}
          </div>
        </div>

        {/* ── Crop Info ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
            🌱 Crop Information
          </h2>
          <Row label="Crop Name"        value={crop.crop_name} />
          <Row label="Category"         value={crop.crop_category} />
          <Row label="Quantity"         value={`${crop.quantity} ${crop.unit}`} />
          <Row label="Cultivation Date" value={crop.cultivation_date} />
          <Row label="Harvest Date"     value={crop.harvest_date} />
          <Row label="Location"         value={crop.location} />
          {crop.description && <Row label="Description" value={crop.description} />}
        </div>

        {/* ── Farmer Identity ───────────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
            🔐 Farmer Identity
          </h2>
          <Row label="Farmer DID" value={crop.farmer_did} />
          <Row label="Wallet"     value={crop.farmer_wallet} />
          <Row label="Location"   value={crop.farmer_location} />
        </div>

        {/* ── NFT Record ───────────────────────────────────────────── */}
        {isMinted && (
          <div className="bg-white rounded-3xl shadow-lg border border-purple-100 p-6 mb-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
              🪙 NFT Blockchain Record
            </h2>
            <Row label="Token ID"    value={`#${crop.nft_token_id}`} />
            <Row
              label="Contract"
              value={crop.nft_contract_address}
              link={`${SEPOLIA_EXPLORER}/address/${crop.nft_contract_address}`}
            />
            <Row
              label="Transaction"
              value={crop.nft_transaction_hash}
              link={`${SEPOLIA_EXPLORER}/tx/${crop.nft_transaction_hash}`}
            />
            <Row
              label="IPFS Metadata"
              value={crop.nft_token_uri}
              link={ipfsGateway(crop.nft_token_uri)}
            />
            {crop.nft_minted_at && (
              <Row label="Minted At" value={new Date(crop.nft_minted_at).toLocaleString()} />
            )}
          </div>
        )}

        {/* ── Phase 2.3: Verified Evidence (public documents) ────────── */}
        <div className="bg-white rounded-3xl shadow-lg border border-blue-100 p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
            📦 Verified Evidence
          </h2>

          {documents.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No documents have been uploaded for this crop yet.</p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-blue-50 border border-blue-100 rounded-xl p-4"
                >
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                      </p>
                      <p className="text-xs text-gray-500">{doc.file_name}</p>
                      <p className="text-xs font-mono text-gray-500 mt-1 break-all">
                        CID: {doc.ipfs_cid}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <a
                        href={doc.gateway_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                      >
                        🔗 View on IPFS
                      </a>
                      <button
                        onClick={() => handleCopyCid(doc.ipfs_cid)}
                        className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200"
                      >
                        {copied === doc.ipfs_cid ? "✅ Copied!" : "📋 Copy CID"}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          FarmerChain · Decentralized Agricultural Supply Chain ·{" "}
          <a
            href="https://sepolia.etherscan.io"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Ethereum Sepolia
          </a>
        </p>
      </div>
    </div>
  );
}
