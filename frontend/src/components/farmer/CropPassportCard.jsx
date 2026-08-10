import React, { useState, useRef, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";
import MintButton from "./MintButton";
import DocumentUploader from "./DocumentUploader";
import DocumentList from "./DocumentList";
import AIVerification from "./AIVerification";
import StatusBadge from "../common/StatusBadge";
import AddressCopy from "../common/AddressCopy";

export default function CropPassportCard({ crop, onMintSuccess }) {
  const isMinted = crop.status === "minted";

  const [showUploader, setShowUploader] = useState(false);
  const [docRefresh, setDocRefresh] = useState(0);

  // QR Code
  const [showQR, setShowQR] = useState(false);
  const qrRef = useRef(null);

  const downloadQR = useCallback(() => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `crop-passport-${crop.id}-qr.png`;
    link.href = url;
    link.click();
  }, [crop.id]);

  const handleUploadSuccess = () => {
    setShowUploader(false);
    setDocRefresh((n) => n + 1);
  };

  // Determine trust milestones based on actual existing data
  const hasDocuments = crop.documents && crop.documents.length > 0;
  const hasAI = !!crop.ai_verification;

  return (
    <div
      className={`rounded-3xl border transition-all p-5 sm:p-6 mb-5 shadow-xs bg-white space-y-5 ${
        isMinted
          ? "border-purple-200/90 hover:border-purple-300 shadow-purple-500/5"
          : "border-slate-200/90 hover:border-slate-300"
      }`}
    >
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-extrabold text-slate-900">
              🌾 {crop.crop_name}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
              {crop.crop_category}
            </span>
            <span className="text-xs font-mono text-slate-400 font-medium">
              Passport #{crop.id}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Digital Crop Twin · {crop.quantity} {crop.unit} cultivated in {crop.location || "Maharashtra, India"}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <StatusBadge status={crop.status} />
        </div>
      </div>

      {/* ── Trust Milestones Indicators ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
          <span>✓</span>
          <span>W3C DID Linked</span>
        </span>
        <span className={`px-2.5 py-1 rounded-full border flex items-center gap-1 ${
          hasDocuments ? "bg-blue-50 text-blue-800 border-blue-200" : "bg-slate-50 text-slate-400 border-slate-200"
        }`}>
          <span>{hasDocuments ? "✓" : "○"}</span>
          <span>IPFS Evidence {hasDocuments ? "Stored" : "Pending"}</span>
        </span>
        <span className={`px-2.5 py-1 rounded-full border flex items-center gap-1 ${
          hasAI ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"
        }`}>
          <span>{hasAI ? "✓" : "○"}</span>
          <span>AI Quality {hasAI ? "Assessed" : "Pending"}</span>
        </span>
        <span className={`px-2.5 py-1 rounded-full border flex items-center gap-1 ${
          isMinted ? "bg-purple-50 text-purple-800 border-purple-200" : "bg-slate-50 text-slate-400 border-slate-200"
        }`}>
          <span>{isMinted ? "✓" : "○"}</span>
          <span>Sepolia NFT {isMinted ? "Minted" : "Pending"}</span>
        </span>
      </div>

      {/* ── Crop Details 4-Column Grid ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lot Quantity</span>
          <span className="font-extrabold text-slate-900 font-mono mt-0.5 block">{crop.quantity} {crop.unit}</span>
        </div>
        <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Farm Location</span>
          <span className="font-semibold text-slate-800 mt-0.5 block truncate">{crop.location || "Maharashtra"}</span>
        </div>
        <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Cultivation Date</span>
          <span className="font-medium text-slate-700 mt-0.5 block">{crop.cultivation_date}</span>
        </div>
        <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Harvest Date</span>
          <span className="font-medium text-slate-700 mt-0.5 block">{crop.harvest_date}</span>
        </div>
      </div>

      {crop.description && (
        <p className="text-xs text-slate-600 bg-slate-50/50 p-3 rounded-xl border border-slate-100 italic">
          "{crop.description}"
        </p>
      )}

      {/* ── On-Chain ERC-721 NFT Certificate Section ──────────────── */}
      {isMinted ? (
        <div className="bg-gradient-to-r from-purple-50/60 via-indigo-50/40 to-purple-50/60 border border-purple-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-base">🪙</span>
              <span className="font-extrabold text-purple-950 text-xs uppercase tracking-wider">
                Sepolia ERC-721 Blockchain Certificate
              </span>
            </div>
            <span className="font-mono text-purple-800 font-extrabold text-xs px-2 py-0.5 rounded-md bg-purple-100 border border-purple-300">
              Token #{crop.nft_token_id}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-purple-200/60">
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500 font-semibold text-[11px]">Contract Address</span>
              <AddressCopy value={crop.nft_contract_address} etherscanType="address" className="text-purple-900" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500 font-semibold text-[11px]">Mint Transaction Hash</span>
              <AddressCopy value={crop.nft_transaction_hash} etherscanType="tx" className="text-purple-900" />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <a
              href={`/crop-passport/${crop.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>🔍</span>
              <span>Public Verification Explorer</span>
            </a>
            <button
              type="button"
              onClick={() => setShowQR((v) => !v)}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>📱</span>
              <span>{showQR ? "Close QR Code" : "Show QR Code"}</span>
            </button>
          </div>

          {/* QR Code Collapsible */}
          {showQR && (
            <div className="mt-4 bg-white border border-purple-200 rounded-2xl p-5 flex flex-col items-center gap-3 shadow-sm animate-fade-in">
              <p className="text-xs text-slate-800 font-extrabold">Public Crop Passport QR Code</p>
              <div ref={qrRef} className="p-3 bg-white rounded-2xl border border-slate-100 shadow-md">
                <QRCodeCanvas
                  value={`${window.location.origin}/crop-passport/${crop.id}`}
                  size={160}
                  level="H"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>
              <button
                type="button"
                onClick={downloadQR}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>⬇</span>
                <span>Download QR Code (PNG)</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-purple-50/40 border border-purple-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-purple-950">Ready for On-Chain Minting</p>
            <p className="text-[11px] text-slate-500">
              Mint your digital twin on Ethereum Sepolia with immutable metadata and token URI.
            </p>
          </div>
          <MintButton crop={crop} onMintSuccess={onMintSuccess} />
        </div>
      )}

      {/* ── Decentralized IPFS Evidence Documents Section ─────────── */}
      <div className="border-t border-slate-100 pt-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm">📦</span>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Decentralized IPFS Evidence Documents
            </h4>
          </div>
          <button
            type="button"
            onClick={() => setShowUploader((v) => !v)}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
          >
            <span>{showUploader ? "✕" : "📤"}</span>
            <span>{showUploader ? "Cancel Upload" : "Upload Evidence"}</span>
          </button>
        </div>

        {showUploader && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl animate-fade-in">
            <DocumentUploader
              cropId={crop.id}
              onUploadSuccess={handleUploadSuccess}
            />
          </div>
        )}

        <DocumentList
          cropId={crop.id}
          refreshTrigger={docRefresh}
        />
      </div>

      {/* ── AI Quality Verification Studio ────────────────────────── */}
      <div className="border-t border-slate-100 pt-4">
        <AIVerification cropId={crop.id} cropName={crop.crop_name} />
      </div>
    </div>
  );
}
