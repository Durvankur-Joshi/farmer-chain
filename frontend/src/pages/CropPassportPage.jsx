import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import AddressCopy from "../components/common/AddressCopy";

const DOC_TYPE_LABELS = {
  crop_image:       "🌾 Crop Image",
  soil_report:      "🧪 Soil Report",
  quality_report:   "📊 Quality Report",
  certification:    "🏆 Certification",
  harvest_document: "📋 Harvest Document",
  other:            "📁 Evidence Document",
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
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 py-2.5 border-b border-slate-700/60 last:border-0 text-xs">
      <span className="font-semibold text-slate-400 shrink-0">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 hover:underline break-all font-mono transition-colors"
        >
          {value}
        </a>
      ) : (
        <span className="text-slate-200 font-medium break-all sm:text-right">{value || "—"}</span>
      )}
    </div>
  );
}

export default function CropPassportPage() {
  const { id } = useParams();
  const [crop, setCrop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState("");
  const [aiVerif, setAiVerif] = useState(null);
  const [timeline, setTimeline] = useState([]);

  useEffect(() => {
    axios
      .get(`/api/farmer/crops/public/${id}/`)
      .then((res) => {
        setCrop(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        if (err.response?.status === 404) setNotFound(true);
      });

    // Fetch public AI verification
    axios
      .get(`/api/farmer/crops/public/${id}/verification/`)
      .then((res) => {
        if (res.data.verification) setAiVerif(res.data);
      })
      .catch(() => {});

    // Fetch public supply-chain timeline
    axios
      .get(`/api/farmer/crops/public/${id}/timeline/`)
      .then((res) => {
        if (res.data.events) setTimeline(res.data.events);
      })
      .catch(() => {});
  }, [id]);

  const handleCopyCid = (cid) => {
    navigator.clipboard.writeText(cid).then(() => {
      setCopied(cid);
      setTimeout(() => setCopied(""), 2000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-100">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-2xl mx-auto animate-spin">
            🌾
          </div>
          <p className="text-xs text-slate-400 font-mono tracking-wider">Verifying Digital Crop Passport #{id}…</p>
        </div>
      </div>
    );
  }

  if (notFound || !crop) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center text-slate-100 font-sans">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-3xl mb-4">
          🔍
        </div>
        <h1 className="text-xl font-bold text-white mb-1">Crop Passport Not Found</h1>
        <p className="text-xs text-slate-400 mb-6 max-w-sm">
          The requested digital passport ID #{id} was not found on the FarmerChain decentralized registry.
        </p>
        <a
          href="/"
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all shadow-md shadow-emerald-900/30"
        >
          ← Return to FarmerChain
        </a>
      </div>
    );
  }

  const isMinted = crop.status === "minted";
  const documents = crop.documents || [];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-10 px-4 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[140px] pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10 space-y-6">

        {/* ── Top Header Brand ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-base font-bold shadow-md shadow-emerald-500/20 text-white">
              🌾
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight">FarmerChain</span>
              <p className="text-[10px] text-slate-400 font-medium">Public Verification Explorer</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Verified Registry Certificate
          </span>
        </div>

        {/* ── Primary Crop Image Banner ─────────────────────────────── */}
        {crop.primary_image_url && (
          <div className="bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-slate-700/80 p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
            <img
              src={crop.primary_image_url}
              alt={crop.crop_name}
              className="w-full sm:w-44 h-32 object-cover rounded-2xl border border-slate-700 shadow-lg shrink-0"
            />
            <div className="space-y-1.5 flex-1 text-xs">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                📸 Primary Crop Image & AI Verification
              </span>
              <h3 className="text-base font-extrabold text-white">{crop.crop_name}</h3>
              {aiVerif?.verification && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Grade {aiVerif.verification.quality_grade}
                  </span>
                  <span className="text-slate-300">
                    Detected: <strong className="text-white">{aiVerif.verification.crop_detected}</strong>
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">
                    Score: {aiVerif.verification.quality_score} / 100
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Passport Hero Card ───────────────────────────────────── */}
        <div className="bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-slate-700/80 p-6 sm:p-8 shadow-2xl shadow-black/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                  Digital Crop Passport #{id}
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">
                  {crop.crop_category}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {crop.crop_name}
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                {crop.quantity} {crop.unit} · Cultivated in {crop.location || "Maharashtra, India"}
              </p>
            </div>

            {/* Verification Seal */}
            <div>
              {(() => {
                const hasNFT = isMinted;
                const hasAI = !!aiVerif?.verification;
                if (hasNFT && hasAI) {
                  return (
                    <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/10">
                      <span className="text-base">🛡️</span>
                      <span>Verified On-Chain + AI Assessed</span>
                    </div>
                  );
                } else if (hasNFT) {
                  return (
                    <div className="px-4 py-2.5 rounded-2xl bg-purple-500/15 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-2">
                      <span className="text-base">🪙</span>
                      <span>Minted on Sepolia</span>
                    </div>
                  );
                } else if (hasAI) {
                  return (
                    <div className="px-4 py-2.5 rounded-2xl bg-blue-500/15 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center gap-2">
                      <span className="text-base">🤖</span>
                      <span>AI Quality Assessed</span>
                    </div>
                  );
                }
                return (
                  <div className="px-4 py-2.5 rounded-2xl bg-slate-700/60 border border-slate-600 text-slate-300 text-xs font-semibold flex items-center gap-2">
                    <span className="text-base">⏳</span>
                    <span>Registered Crop Twin</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ── Details Grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Crop Specifications */}
          <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700/80 p-5 sm:p-6 shadow-xl">
            <h2 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>🌱</span> Crop Specifications
            </h2>
            <div className="space-y-1">
              <Row label="Crop Name" value={crop.crop_name} />
              <Row label="Category" value={crop.crop_category} />
              <Row label="Batch Quantity" value={`${crop.quantity} ${crop.unit}`} />
              <Row label="Cultivation Date" value={crop.cultivation_date} />
              <Row label="Harvest Date" value={crop.harvest_date} />
              <Row label="Origin Location" value={crop.location} />
              {crop.description && <Row label="Agronomic Notes" value={crop.description} />}
            </div>
          </div>

          {/* Farmer Provenance & DID */}
          <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700/80 p-5 sm:p-6 shadow-xl">
            <h2 className="text-xs font-extrabold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>🔐</span> Provenance & Producer DID
            </h2>
            <div className="space-y-2">
              <div className="py-2 border-b border-slate-700/60">
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">Farmer W3C DID</span>
                <AddressCopy value={crop.farmer_did} truncate={false} className="text-slate-200 break-all text-[11px]" />
              </div>
              <div className="py-2 border-b border-slate-700/60">
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">Registered Wallet</span>
                <AddressCopy value={crop.farmer_wallet} etherscanType="address" truncate={false} className="text-slate-200 break-all text-[11px]" />
              </div>
              <Row label="Producer Region" value={crop.farmer_location} />
            </div>
          </div>
        </div>

        {/* ── NFT Blockchain Record ─────────────────────────────────── */}
        {isMinted && (
          <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-purple-500/40 p-5 sm:p-6 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
              <h2 className="text-xs font-extrabold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                <span>🪙</span> ERC-721 Blockchain Certificate (Ethereum Sepolia)
              </h2>
              <span className="font-mono text-purple-300 font-extrabold text-xs px-2.5 py-0.5 rounded-lg bg-purple-500/20 border border-purple-500/40">
                Token #{crop.nft_token_id}
              </span>
            </div>

            <div className="space-y-1">
              <div className="py-2 border-b border-slate-700/60 flex flex-col sm:flex-row sm:items-start justify-between gap-1 text-xs">
                <span className="font-semibold text-slate-400">Contract Address</span>
                <AddressCopy value={crop.nft_contract_address} etherscanType="address" truncate={false} className="text-purple-300" />
              </div>
              <div className="py-2 border-b border-slate-700/60 flex flex-col sm:flex-row sm:items-start justify-between gap-1 text-xs">
                <span className="font-semibold text-slate-400">Mint Transaction</span>
                <AddressCopy value={crop.nft_transaction_hash} etherscanType="tx" truncate={false} className="text-purple-300" />
              </div>
              <Row
                label="IPFS Token URI"
                value={crop.nft_token_uri}
                link={ipfsGateway(crop.nft_token_uri)}
              />
              {crop.nft_minted_at && (
                <Row label="Minted On" value={new Date(crop.nft_minted_at).toLocaleString()} />
              )}
            </div>
          </div>
        )}

        {/* ── AI Quality Verification ───────────────────────────────── */}
        <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700/80 p-5 sm:p-6 shadow-xl space-y-4">
          <h2 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <span>🤖</span> Gemini Vision AI Quality Assessment
          </h2>

          {!aiVerif ? (
            <p className="text-xs text-slate-500 italic">Visual crop quality assessment not performed for this lot yet.</p>
          ) : (() => {
            const v = aiVerif.verification;
            const GRADE_COLORS = {
              A: "text-emerald-400 bg-emerald-500/15 border-emerald-500/40",
              B: "text-blue-400 bg-blue-500/15 border-blue-500/40",
              C: "text-yellow-400 bg-yellow-500/15 border-yellow-500/40",
              D: "text-orange-400 bg-orange-500/15 border-orange-500/40",
              F: "text-rose-400 bg-rose-500/15 border-rose-500/40",
            };
            const gradeClass = GRADE_COLORS[v.quality_grade] || "text-slate-300 bg-slate-700/50 border-slate-600";
            const pct = Math.max(0, Math.min(100, Number(v.quality_score) || 0));

            return (
              <div className="space-y-4">
                <div className="flex gap-4 items-center flex-wrap">
                  <div className={`${gradeClass} rounded-2xl p-4 text-center min-w-[100px] border shadow-md`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quality Grade</p>
                    <p className="text-3xl font-extrabold">{v.quality_grade}</p>
                  </div>

                  <div className="flex-1 min-w-[180px] space-y-2">
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                        <span>Quality Score</span>
                        <span>{v.quality_score} / 100</span>
                      </div>
                      <div className="w-full bg-slate-700/70 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
                        <span>Model Confidence</span>
                        <span>{Math.round(v.confidence_score * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-700/70 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.round(v.confidence_score * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Row label="Identified Species" value={v.crop_detected} />
                  <Row label="Plant Health / Disease" value={v.disease_detected ? `⚠️ ${v.disease_name || "Disease Detected"}` : "✓ Clean — No Disease Observed"} />
                  <Row label="Defect Notes" value={v.visible_defects || "None detected"} />
                  {v.ai_summary && (
                    <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-3.5 text-xs text-slate-300 italic">
                      "{v.ai_summary}"
                    </div>
                  )}
                  {v.image_gateway_url && (
                    <div className="pt-2">
                      <a
                        href={v.image_gateway_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium"
                      >
                        🔗 View Verified Analysis Image on IPFS →
                      </a>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-700/60">
                  ⚠️ {aiVerif.disclaimer}
                </p>
              </div>
            );
          })()}
        </div>

        {/* ── Verified IPFS Evidence Documents ──────────────────────── */}
        <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700/80 p-5 sm:p-6 shadow-xl space-y-3">
          <h2 className="text-xs font-extrabold text-blue-400 uppercase tracking-wider flex items-center gap-2">
            <span>📦</span> Decentralized IPFS Evidence Files ({documents.length})
          </h2>

          {documents.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No evidence documents uploaded for this crop yet.</p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white">
                      {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                    </p>
                    <p className="text-[11px] text-slate-400">{doc.file_name}</p>
                    <p className="text-[10px] font-mono text-slate-500 break-all">
                      CID: {doc.ipfs_cid}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={doc.gateway_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-1.5 rounded-xl transition-all shadow-xs"
                    >
                      View on IPFS
                    </a>
                    <button
                      onClick={() => handleCopyCid(doc.ipfs_cid)}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-600 cursor-pointer font-semibold"
                    >
                      {copied === doc.ipfs_cid ? "✓ Copied" : "Copy CID"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Supply-Chain Traceability Timeline ─────────────────────── */}
        <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700/80 p-5 sm:p-6 shadow-xl space-y-4">
          <h2 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <span>📦</span> Supply-Chain Traceability Timeline
          </h2>

          {timeline.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No supply-chain events recorded yet.</p>
          ) : (
            <div className="relative pl-2 pt-2">
              <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-slate-700" />
              <div className="space-y-5">
                {timeline.map((evt, idx) => {
                  const ICONS = {
                    crop_registered: "🌱",
                    document_uploaded: "📄",
                    ai_verified: "🤖",
                    nft_minted: "🏷️",
                    quote_created: "📝",
                    bid_accepted: "🤝",
                    escrow_created: "🔐",
                    escrow_funded: "💰",
                    delivery_confirmed: "🚚",
                    payment_released: "💸",
                  };
                  const icon = ICONS[evt.type] || "✓";
                  const d = evt.details || {};
                  const ts = new Date(evt.timestamp).toLocaleString();

                  return (
                    <div key={idx} className="relative flex items-start gap-4">
                      <div className="z-10 flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border-2 border-emerald-500/80 text-sm shrink-0 shadow-md">
                        {icon}
                      </div>

                      <div className="flex-1 bg-slate-900/50 border border-slate-700/60 rounded-2xl p-3.5 space-y-1">
                        <div className="flex justify-between items-start gap-2 flex-wrap">
                          <p className="text-xs font-bold text-white">{evt.title}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{ts}</span>
                        </div>

                        {evt.type === "ai_verified" && d.quality_grade && (
                          <p className="text-[11px] text-emerald-300">
                            Grade {d.quality_grade} · Score {d.quality_score}/100
                          </p>
                        )}
                        {evt.type === "nft_minted" && d.token_id && (
                          <p className="text-[11px] text-purple-300 font-mono">
                            Token #{d.token_id}
                            {d.etherscan_url && (
                              <> · <a href={d.etherscan_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Etherscan</a></>
                            )}
                          </p>
                        )}
                        {evt.type === "document_uploaded" && d.gateway_url && (
                          <a href={d.gateway_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:underline">
                            View Document on IPFS →
                          </a>
                        )}
                        {evt.type === "bid_accepted" && d.fpo_name && (
                          <p className="text-[11px] text-slate-300">
                            FPO: <span className="font-semibold text-white">{d.fpo_name}</span> · {d.bid_amount} ETH/unit
                          </p>
                        )}
                        {evt.type === "escrow_created" && d.amount_eth && (
                          <p className="text-[11px] text-amber-300 font-mono">
                            {d.amount_eth} ETH Locked
                            {d.etherscan_url && (
                              <> · <a href={d.etherscan_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Contract</a></>
                            )}
                          </p>
                        )}
                        {(evt.type === "escrow_funded" || evt.type === "payment_released") && d.etherscan_url && (
                          <a href={d.etherscan_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-400 hover:underline">
                            Verify Tx on Sepolia Etherscan →
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-500 pt-4">
          FarmerChain Decentralized Trust Protocol · Powered by Ethereum Sepolia, W3C DID, IPFS & Gemini AI
        </p>
      </div>
    </div>
  );
}
