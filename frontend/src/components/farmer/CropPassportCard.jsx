/**
 * CropPassportCard.jsx — Phase 2.2 + 2.3 + 2.6 + UI Modernization
 * Displays one CropPassport record with clean Web3 styling.
 */
import React, { useState, useRef, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";
import MintButton from "./MintButton";
import DocumentUploader from "./DocumentUploader";
import DocumentList from "./DocumentList";
import AIVerification from "./AIVerification";
import StatusBadge from "../common/StatusBadge";
import AddressCopy from "../common/AddressCopy";

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

function ipfsGateway(uri) {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`;
  }
  return uri;
}

export default function CropPassportCard({ crop, onMintSuccess }) {
  const isMinted = crop.status === "minted";

  const [showUploader, setShowUploader] = useState(false);
  const [docRefresh, setDocRefresh]     = useState(0);

  // Phase 2.6 — QR Code
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

  return (
    <div
      className={`rounded-2xl border transition-all p-5 mb-4 shadow-xs bg-white ${
        isMinted
          ? "border-purple-200/80 hover:border-purple-300"
          : "border-slate-200/80 hover:border-slate-300"
      }`}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex justify-between items-start gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-slate-900">
              🌾 {crop.crop_name}
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
              {crop.crop_category}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono">Lot ID #{crop.id}</p>
        </div>

        <StatusBadge status={crop.status} />
      </div>

      {/* ── Crop Details Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
        <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Quantity</span>
          <span className="font-bold text-slate-800">{crop.quantity} {crop.unit}</span>
        </div>
        <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Location</span>
          <span className="font-semibold text-slate-800">{crop.location || "Maharashtra"}</span>
        </div>
        <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Cultivation</span>
          <span className="font-medium text-slate-700">{crop.cultivation_date}</span>
        </div>
        <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Harvest</span>
          <span className="font-medium text-slate-700">{crop.harvest_date}</span>
        </div>
      </div>

      {/* ── NFT Details ───────────────────────────────────────────── */}
      {isMinted && (
        <div className="bg-purple-50/40 border border-purple-100 rounded-xl p-4 mb-4 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-bold text-purple-900 text-xs">🪙 Sepolia NFT Digital Certificate</span>
            <span className="font-mono text-purple-700 font-bold">#{crop.nft_token_id}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-purple-100">
            <div>
              <span className="text-slate-500 font-medium">Contract: </span>
              <AddressCopy value={crop.nft_contract_address} etherscanType="address" className="text-purple-800" />
            </div>
            <div>
              <span className="text-slate-500 font-medium">Mint Tx: </span>
              <AddressCopy value={crop.nft_transaction_hash} etherscanType="tx" className="text-purple-800" />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <a
              href={`/crop-passport/${crop.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-1.5 rounded-lg transition-all shadow-xs"
            >
              🔍 Public Verification Page
            </a>
            <button
              onClick={() => setShowQR((v) => !v)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-white font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              {showQR ? "✕ Close QR" : "📱 QR Code"}
            </button>
          </div>

          {/* Phase 2.6: QR Code */}
          {showQR && (
            <div className="mt-3 bg-white border border-purple-200 rounded-xl p-5 flex flex-col items-center gap-3 shadow-sm">
              <p className="text-xs text-slate-700 font-bold">Public Verification QR Code</p>
              <div ref={qrRef} className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
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
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>⬇</span>
                <span>Download PNG QR</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Mint button ───────────────────────────────────────────── */}
      {!isMinted && (
        <div className="mb-4">
          <MintButton crop={crop} onMintSuccess={onMintSuccess} />
        </div>
      )}

      {/* ── Phase 2.3: Decentralized Documents ───────────────────── */}
      <div className="border-t border-slate-100 pt-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">📦</span>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              IPFS Evidence Documents
            </h4>
          </div>
          <button
            onClick={() => setShowUploader((v) => !v)}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1 rounded-lg transition-all cursor-pointer"
          >
            {showUploader ? "✕ Cancel" : "📤 Upload Evidence"}
          </button>
        </div>

        {showUploader && (
          <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
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

      {/* ── Phase 2.4: AI Quality Verification ────────────────── */}
      <div className="border-t border-slate-100 pt-4">
        <AIVerification cropId={crop.id} cropName={crop.crop_name} />
      </div>
    </div>
  );
}
