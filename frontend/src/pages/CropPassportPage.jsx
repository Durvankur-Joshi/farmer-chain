/**
 * CropPassportPage.jsx — Phase 2.2 + 2.3 + 2.4
 * Public verification page. No authentication required.
 * Route: /crop-passport/:id
 *
 * Phase 2.3: Shows public IPFS documents section.
 * Phase 2.4: Shows public AI Quality Verification result.
 * Never exposes: email, aadhaar, password, Pinata/Gemini credentials.
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
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied]     = useState("");
  const [aiVerif, setAiVerif]   = useState(null);   // public AI verification result

  useEffect(() => {
    axios
      .get(`/api/farmer/crops/public/${id}/`)
      .then((res) => { setCrop(res.data); setLoading(false); })
      .catch((err) => {
        setLoading(false);
        if (err.response?.status === 404) setNotFound(true);
      });

    // Fetch public AI verification (best-effort, non-blocking)
    axios
      .get(`/api/farmer/crops/public/${id}/verification/`)
      .then((res) => { if (res.data.verification) setAiVerif(res.data); })
      .catch(() => {/* no verified result yet — silently ignore */});
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

        {/* ── Phase 2.4: Public AI Quality Verification ───────────────── */}
        <div className="bg-white rounded-3xl shadow-lg border border-purple-100 p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
            🤖 AI Quality Verification
          </h2>
          {!aiVerif ? (
            <p className="text-sm text-gray-400 italic">No AI verification has been submitted for this crop yet.</p>
          ) : (() => {
            const v = aiVerif.verification;
            const GRADE_COLORS = { A:"text-green-700 bg-green-100", B:"text-lime-700 bg-lime-100", C:"text-yellow-700 bg-yellow-100", D:"text-orange-700 bg-orange-100", F:"text-red-700 bg-red-100" };
            const gradeClass = GRADE_COLORS[v.quality_grade] || "text-gray-700 bg-gray-100";
            const pct = Math.max(0,Math.min(100,Number(v.quality_score)||0));
            const barColor = pct>=80?"bg-green-500":pct>=60?"bg-lime-500":pct>=40?"bg-yellow-500":pct>=20?"bg-orange-500":"bg-red-500";
            return (
              <div className="space-y-3">
                <div className="flex gap-3 flex-wrap items-start">
                  <div className={`${gradeClass} rounded-xl px-4 py-2 text-center min-w-[90px] border`}>
                    <p className="text-xs font-semibold uppercase">Grade</p>
                    <p className="text-4xl font-extrabold">{v.quality_grade}</p>
                  </div>
                  <div className="flex-1 min-w-[180px] space-y-2">
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-gray-600">
                        <span>Quality Score</span><span>{v.quality_score}/100</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div className={`${barColor} h-2 rounded-full`} style={{width:`${pct}%`}} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-gray-600">
                        <span>Confidence</span><span>{Math.round(v.confidence_score*100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div className="bg-blue-500 h-2 rounded-full" style={{width:`${Math.round(v.confidence_score*100)}%`}} />
                      </div>
                    </div>
                  </div>
                </div>
                <Row label="Crop Detected" value={v.crop_detected} />
                <Row label="Disease" value={v.disease_detected ? `⚠️ ${v.disease_name||"Detected"}` : "✓ Not detected"} />
                <Row label="Visible Defects" value={v.visible_defects||"None"} />
                {v.ai_summary && (
                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-sm text-gray-700 italic">"{v.ai_summary}"</div>
                )}
                {v.image_gateway_url && (
                  <a href={v.image_gateway_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">🔗 View verified crop image on IPFS</a>
                )}
                <p className="text-xs text-gray-400 italic mt-1">⚠️ {aiVerif.disclaimer}</p>
              </div>
            );
          })()}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          FarmerChain · Decentralized Agricultural Supply Chain ·{" "}
          <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer" className="underline">
            Ethereum Sepolia
          </a>
        </p>
      </div>
    </div>
  );
}
