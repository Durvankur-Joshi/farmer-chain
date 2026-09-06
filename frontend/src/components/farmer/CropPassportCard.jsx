import React, { useState, useRef, useCallback } from "react";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import { useRefresh } from "../../context/useRefresh";
import MintButton from "./MintButton";
import DocumentUploader from "./DocumentUploader";
import DocumentList from "./DocumentList";
import AIVerification from "./AIVerification";
import StatusBadge from "../common/StatusBadge";
import AddressCopy from "../common/AddressCopy";
import BaseModal from "../common/BaseModal";

export default function CropPassportCard({
  crop,
  onMintSuccess,
  onDeleteSuccess,
  onPassportUpdated,
  onViewOffers,
  hasActiveOffers = false,
  activeOffersCount = 0,
}) {
  const { refresh } = useRefresh();
  const isMinted = crop.status === "minted";

  // Modals state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [docRefresh, setDocRefresh] = useState(0);

  // Deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

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
    if (onPassportUpdated) onPassportUpdated();
    refresh(["farmer", "provenance"]);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      await axios.delete(`/api/farmer/crops/${crop.id}/`, {
        withCredentials: true,
      });
      setShowDeleteModal(false);
      setShowDetailsModal(false);
      onDeleteSuccess && onDeleteSuccess();
      refresh(["farmer", "quotes", "inventory", "deals"]);
    } catch (err) {
      console.error("Error deleting crop passport:", err.response?.data || err);
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Failed to delete Crop Passport. Please ensure it is not linked to active quotes or escrow.";
      setDeleteError(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Extract AI Grade if present
  const aiGrade = crop.latest_ai_verification?.quality_grade || crop.ai_grade;
  const availQty = crop.available_quantity !== undefined ? crop.available_quantity : crop.quantity;

  return (
    <>
      {/* ── Compact Visual Crop Passport Card ──────────────────────── */}
      <div
        className={`bg-white border rounded-2xl p-4 sm:p-4.5 transition-all shadow-2xs hover:border-emerald-300 hover:shadow-xs flex flex-col justify-between gap-3 min-w-0 ${
          isMinted ? "border-purple-200/90" : "border-slate-200/90"
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          {/* Crop Image or Icon Fallback */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0 relative flex items-center justify-center">
            {crop.primary_image_url ? (
              <img
                src={crop.primary_image_url}
                alt={crop.crop_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl sm:text-3xl">🌾</span>
            )}
            {aiGrade && (
              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white font-extrabold text-[9px] shadow-2xs">
                Grade {aiGrade}
              </span>
            )}
          </div>

          {/* Core Info */}
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
                {crop.crop_name}
              </h4>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                {crop.crop_category}
              </span>
            </div>

            <p className="text-xs text-slate-600 font-semibold font-mono">
              {availQty} / {crop.quantity} {crop.unit}
            </p>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <StatusBadge status={crop.status} />

              {isMinted ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                  <span>💎</span>
                  <span>NFT #{crop.nft_token_id}</span>
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  Passport #{crop.id}
                </span>
              )}

              {hasActiveOffers && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  🤝 {activeOffersCount > 0 ? `${activeOffersCount} Offer(s)` : "Active Deal"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Primary Actions */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-400 font-medium truncate">
            📍 {crop.location || "Farm Field"}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            {onViewOffers && (
              <button
                type="button"
                onClick={() => onViewOffers(crop)}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span>🤝</span>
                <span>Offers</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowDetailsModal(true)}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
            >
              <span>🔍</span>
              <span>View Details</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Farmer Crop Details Modal ─────────────────────────────── */}
      <BaseModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={crop.crop_name}
        subtitle={`${crop.crop_category} · Digital Crop Passport #${crop.id}`}
        icon="🌾"
        badge={<StatusBadge status={crop.status} />}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setShowDeleteModal(true);
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-xl hover:bg-rose-50 transition-all cursor-pointer flex items-center gap-1"
            >
              <span>🗑️</span>
              <span>Delete Passport</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDetailsModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Top Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Available / Total Qty</span>
              <span className="font-extrabold font-mono text-slate-900 block mt-0.5 truncate">
                {availQty} / {crop.quantity} {crop.unit}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Farm Location</span>
              <span className="font-semibold text-slate-800 block mt-0.5 truncate">
                {crop.location || "Maharashtra"}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Cultivation Date</span>
              <span className="font-medium text-slate-700 block mt-0.5 truncate">
                {crop.cultivation_date || "N/A"}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Harvest Date</span>
              <span className="font-medium text-slate-700 block mt-0.5 truncate">
                {crop.harvest_date || "N/A"}
              </span>
            </div>
          </div>

          {crop.description && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 italic">
              "{crop.description}"
            </div>
          )}

          {/* AI Verification & Primary Photo Assessment */}
          {crop.primary_image_url && (
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-purple-50/50 p-3.5 rounded-2xl border border-purple-200/80">
              <img
                src={crop.primary_image_url}
                alt={crop.crop_name}
                className="w-full sm:w-28 h-24 object-cover rounded-xl border border-purple-200 shadow-xs shrink-0"
              />
              <div className="space-y-1 text-xs min-w-0 flex-1">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                  📸 Verified Primary Crop Photo
                </span>
                <p className="font-extrabold text-slate-900">{crop.crop_name}</p>
                {crop.latest_ai_verification && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      Grade {crop.latest_ai_verification.quality_grade}
                    </span>
                    <span className="text-[11px] text-slate-600 font-medium">
                      Crop: <strong>{crop.latest_ai_verification.crop_detected}</strong>
                    </span>
                    <span className="text-[11px] font-mono text-purple-800 font-bold">
                      Score: {crop.latest_ai_verification.quality_score} / 100
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Standalone AI Verification Studio if no photo yet */}
          {!crop.primary_image_url && !crop.latest_ai_verification && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <AIVerification
                cropId={crop.id}
                cropName={crop.crop_name}
                onVerificationSuccess={() => {
                  if (onPassportUpdated) onPassportUpdated();
                }}
              />
            </div>
          )}

          {/* Evidence Documents Section */}
          <div className="border border-slate-200/80 rounded-2xl p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span>📁</span>
                <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Decentralized IPFS Evidence
                </h5>
              </div>
              <button
                type="button"
                onClick={() => setShowUploader((v) => !v)}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
              >
                <span>{showUploader ? "✕" : "📤"}</span>
                <span>{showUploader ? "Cancel" : "Upload File"}</span>
              </button>
            </div>

            {showUploader && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl animate-fade-in">
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

          {/* Collapsible Verification & Blockchain Details */}
          <details className="group border border-purple-200/80 rounded-2xl p-4 bg-purple-50/30 text-xs">
            <summary className="font-bold text-purple-950 cursor-pointer flex items-center justify-between select-none list-none">
              <div className="flex items-center gap-2">
                <span>⛓️</span>
                <span className="text-xs font-extrabold text-purple-900">
                  Verification & Blockchain Details
                </span>
                {isMinted && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                    Sepolia ERC-721
                  </span>
                )}
              </div>
              <span className="text-xs text-purple-600 group-open:rotate-180 transition-transform font-bold">
                ▼
              </span>
            </summary>

            <div className="space-y-3 pt-3 mt-3 border-t border-purple-200/60">
              {isMinted ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold text-[11px]">Token ID:</span>
                    <span className="font-mono text-purple-900 font-extrabold text-xs px-2 py-0.5 rounded bg-purple-100 border border-purple-200">
                      Token #{crop.nft_token_id}
                    </span>
                  </div>

                  {crop.nft_contract_address && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-slate-500 font-semibold text-[11px]">Contract Address:</span>
                      <AddressCopy value={crop.nft_contract_address} etherscanType="address" />
                    </div>
                  )}

                  {crop.nft_transaction_hash && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-slate-500 font-semibold text-[11px]">Mint Transaction:</span>
                      <AddressCopy value={crop.nft_transaction_hash} etherscanType="tx" />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={`/crop-passport/${crop.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1"
                    >
                      <span>🔍</span>
                      <span>Public Explorer</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowQR((v) => !v)}
                      className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>📱</span>
                      <span>{showQR ? "Close QR" : "Show QR Code"}</span>
                    </button>
                  </div>

                  {showQR && (
                    <div className="p-4 bg-white border border-purple-200 rounded-2xl flex flex-col items-center gap-3 shadow-xs animate-fade-in">
                      <div ref={qrRef} className="p-3 bg-white rounded-xl border border-slate-100 shadow-xs">
                        <QRCodeCanvas
                          value={`${window.location.origin}/crop-passport/${crop.id}`}
                          size={140}
                          level="H"
                          includeMargin={true}
                          bgColor="#ffffff"
                          fgColor="#0f172a"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={downloadQR}
                        className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                      >
                        ⬇ Download QR Code
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <p className="text-xs font-bold text-purple-950">Ready for On-Chain Minting</p>
                    <p className="text-[11px] text-slate-500">Mint ERC-721 token on Ethereum Sepolia.</p>
                  </div>
                  <MintButton crop={crop} onMintSuccess={onMintSuccess} />
                </div>
              )}
            </div>
          </details>
        </div>
      </BaseModal>

      {/* ── Delete Confirmation Modal ──────────────────────────────── */}
      {showDeleteModal && (
        <BaseModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title={`Delete Crop Passport #${crop.id}?`}
          subtitle={`${crop.crop_name} (${crop.quantity} ${crop.unit})`}
          icon="⚠️"
          maxWidth="max-w-md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span>{deleteLoading ? "Deleting…" : "🗑️ Confirm Delete"}</span>
              </button>
            </div>
          }
        >
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete this Crop Passport? This will permanently remove it from your active FarmerChain registry.
          </p>

          {isMinted && (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <span>ℹ️</span>
                <span>On-Chain Record Notice</span>
              </p>
              <p className="text-[11px] text-purple-800">
                This passport has an ERC-721 NFT (Token #{crop.nft_token_id}) on Ethereum Sepolia. Deleting this local record will not alter decentralized blockchain records.
              </p>
            </div>
          )}

          {deleteError && (
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs font-semibold text-rose-800">
              ❌ {deleteError}
            </div>
          )}
        </BaseModal>
      )}
    </>
  );
}
