/**
 * CropPassportCard.jsx — Phase 2.2 + 2.3
 *
 * Displays one CropPassport record.
 * Phase 2.2: NFT details + MintButton
 * Phase 2.3: Decentralized Documents section (upload + list)
 */
import React, { useState } from "react";
import MintButton from "./MintButton";
import DocumentUploader from "./DocumentUploader";
import DocumentList from "./DocumentList";
import AIVerification from "./AIVerification";

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

function truncate(str, n = 12) {
  if (!str) return "—";
  if (str.length <= n) return str;
  return str.slice(0, 8) + "…" + str.slice(-6);
}

function ipfsGateway(uri) {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`;
  }
  return uri;
}

export default function CropPassportCard({ crop, onMintSuccess }) {
  const isMinted = crop.status === "minted";

  // Controls visibility of the upload form and triggers doc list refresh
  const [showUploader, setShowUploader] = useState(false);
  const [docRefresh, setDocRefresh]     = useState(0);

  const handleUploadSuccess = () => {
    setShowUploader(false);
    setDocRefresh((n) => n + 1); // triggers DocumentList to re-fetch
  };

  return (
    <div
      className={`rounded-2xl border shadow p-5 mb-4 ${
        isMinted ? "border-purple-200 bg-purple-50" : "border-gray-200 bg-white"
      }`}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-base font-bold text-gray-800">🌾 {crop.crop_name}</h3>
          <p className="text-xs text-gray-500">{crop.crop_category}</p>
        </div>
        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full ${
            isMinted
              ? "bg-purple-200 text-purple-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {isMinted ? "✅ NFT Minted" : "📋 Registered"}
        </span>
      </div>

      {/* ── Crop Details ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700 mb-3">
        <p><span className="font-medium text-gray-500">Quantity:</span> {crop.quantity} {crop.unit}</p>
        <p><span className="font-medium text-gray-500">Location:</span> {crop.location || "—"}</p>
        <p><span className="font-medium text-gray-500">Cultivation:</span> {crop.cultivation_date}</p>
        <p><span className="font-medium text-gray-500">Harvest:</span> {crop.harvest_date}</p>
        {crop.farmer_did && (
          <p className="col-span-2 break-all">
            <span className="font-medium text-gray-500">DID:</span>{" "}
            <span className="text-xs">{crop.farmer_did}</span>
          </p>
        )}
      </div>

      {/* ── NFT Details ───────────────────────────────────────────── */}
      {isMinted && (
        <div className="border-t border-purple-200 pt-3 mt-3 space-y-1 text-xs text-gray-700">
          <p>
            <span className="font-medium text-gray-500">Token ID: </span>
            <span className="font-mono">#{crop.nft_token_id}</span>
          </p>
          <p>
            <span className="font-medium text-gray-500">Contract: </span>
            <a
              href={`${SEPOLIA_EXPLORER}/address/${crop.nft_contract_address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline font-mono"
            >
              {truncate(crop.nft_contract_address, 20)}
            </a>
          </p>
          <p>
            <span className="font-medium text-gray-500">Tx Hash: </span>
            <a
              href={`${SEPOLIA_EXPLORER}/tx/${crop.nft_transaction_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline font-mono"
            >
              {truncate(crop.nft_transaction_hash, 20)}
            </a>
          </p>
          {crop.nft_token_uri && (
            <p>
              <span className="font-medium text-gray-500">Metadata: </span>
              <a
                href={ipfsGateway(crop.nft_token_uri)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                {crop.nft_token_uri}
              </a>
            </p>
          )}
          {crop.nft_minted_at && (
            <p>
              <span className="font-medium text-gray-500">Minted at: </span>
              {new Date(crop.nft_minted_at).toLocaleString()}
            </p>
          )}

          <div className="mt-2 flex gap-2">
            <a
              href={`/crop-passport/${crop.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded hover:bg-purple-700"
            >
              🔍 View Passport
            </a>
          </div>
        </div>
      )}

      {/* ── Mint button ───────────────────────────────────────────── */}
      {!isMinted && <MintButton crop={crop} onMintSuccess={onMintSuccess} />}

      {/* ── Phase 2.3: Decentralized Documents ───────────────────── */}
      <div className="border-t border-gray-200 mt-4 pt-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-bold text-gray-700">📦 Decentralized Documents</h4>
          <button
            onClick={() => setShowUploader((v) => !v)}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            {showUploader ? "✕ Cancel" : "📤 Upload Evidence"}
          </button>
        </div>

        {showUploader && (
          <DocumentUploader
            cropId={crop.id}
            onUploadSuccess={handleUploadSuccess}
          />
        )}

        <DocumentList
          cropId={crop.id}
          refreshTrigger={docRefresh}
        />
      </div>

      {/* ── Phase 2.4: AI Quality Verification ────────────────── */}
      <AIVerification cropId={crop.id} cropName={crop.crop_name} />
    </div>
  );
}
