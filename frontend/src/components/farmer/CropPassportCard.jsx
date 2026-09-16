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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info, Trash2, ExternalLink, QrCode } from "lucide-react";

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
      {/* ── Compact Crop Card ─────────────────────────────────────── */}
      <Card
        className={`p-3.5 sm:p-4 transition-all hover:border-emerald-300 hover:shadow-xs flex flex-col justify-between gap-3 min-w-0 ${
          isMinted ? "border-purple-200/90" : "border-slate-200/80"
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          {/* Crop Image or Icon Fallback */}
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0 relative flex items-center justify-center">
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
              <h4 className="text-sm font-bold text-slate-900 tracking-tight truncate">
                {crop.crop_name}
              </h4>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                {crop.crop_category}
              </Badge>
            </div>

            <p className="text-xs text-slate-600 font-semibold font-mono">
              {availQty} / {crop.quantity} {crop.unit}
            </p>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <StatusBadge status={crop.status} />

              {crop.latest_ai_verification?.verification_status === "verified" ? (
                <Badge variant="success" className="text-[10px] py-0 px-1.5">
                  ✓ AI Verified
                </Badge>
              ) : crop.latest_ai_verification?.verification_status === "failed" ? (
                <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                  ⚠️ Review
                </Badge>
              ) : null}

              {isMinted ? (
                <Badge variant="purple" className="text-[10px] py-0 px-1.5">
                  📜 #{crop.nft_token_id}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                  #{crop.id}
                </Badge>
              )}

              {hasActiveOffers && (
                <Badge variant="amber" className="text-[10px] py-0 px-1.5">
                  🤝 {activeOffersCount > 0 ? `${activeOffersCount} Offer(s)` : "Active"}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-400 font-medium truncate">
            📍 {crop.location || "Farm Field"}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            {onViewOffers && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onViewOffers(crop)}
                className="h-7 px-2.5 text-xs text-emerald-800 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
              >
                <span>🤝</span>
                <span>Offers</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={() => setShowDetailsModal(true)}
              className="h-7 px-2.5 text-xs bg-slate-900 hover:bg-slate-800 text-white"
            >
              <span>🔍</span>
              <span>Details</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* ── View Crop Details Dialog (shadcn Dialog) ─────────────── */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap pr-6">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌾</span>
                <DialogTitle>{crop.crop_name}</DialogTitle>
                <Badge variant="outline" className="text-[11px]">
                  {crop.crop_category}
                </Badge>
              </div>
              <StatusBadge status={crop.status} />
            </div>
            <DialogDescription>
              Crop Passport Record #{crop.id} · Immutable harvest specifications and quality verification
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            {/* 4-Item Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">
                  Available / Total
                </span>
                <span className="font-extrabold font-mono text-slate-900 block mt-0.5">
                  {availQty} / {crop.quantity} {crop.unit}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">
                  Farm Location
                </span>
                <span className="font-semibold text-slate-800 block mt-0.5 truncate">
                  {crop.location || "Maharashtra"}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">
                  Cultivation Date
                </span>
                <span className="font-medium text-slate-700 block mt-0.5">
                  {crop.cultivation_date || "N/A"}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">
                  Harvest Date
                </span>
                <span className="font-medium text-slate-700 block mt-0.5">
                  {crop.harvest_date || "N/A"}
                </span>
              </div>
            </div>

            {crop.description && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-600 italic">
                "{crop.description}"
              </div>
            )}

            {/* AI Verification & Primary Photo */}
            {crop.primary_image_url && (
              <div className="flex flex-col sm:flex-row items-center gap-3 bg-emerald-50/40 p-3 rounded-xl border border-emerald-200/80">
                <img
                  src={crop.primary_image_url}
                  alt={crop.crop_name}
                  className="w-full sm:w-28 h-24 object-cover rounded-lg border border-emerald-200 shrink-0"
                />
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    📸 Verified Harvest Photo
                  </span>
                  <p className="font-bold text-slate-900">{crop.crop_name}</p>
                  {crop.latest_ai_verification && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Badge variant="success" className="text-[11px]">
                        Grade {crop.latest_ai_verification.quality_grade}
                      </Badge>
                      <span className="text-[11px] text-slate-600 font-medium">
                        Crop: <strong>{crop.latest_ai_verification.crop_detected}</strong>
                      </span>
                      <span className="text-[11px] font-mono text-emerald-800 font-bold">
                        Score: {crop.latest_ai_verification.quality_score} / 100
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Standalone AI Verification if photo missing */}
            {!crop.primary_image_url && !crop.latest_ai_verification && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
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
            <div className="border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span>📁</span>
                  <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Decentralized IPFS Evidence
                  </h5>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUploader((v) => !v)}
                  className="h-7 text-xs"
                >
                  {showUploader ? "✕ Cancel" : "📤 Upload File"}
                </Button>
              </div>

              {showUploader && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg animate-fade-in">
                  <DocumentUploader
                    cropId={crop.id}
                    onUploadSuccess={handleUploadSuccess}
                  />
                </div>
              )}

              <DocumentList cropId={crop.id} refreshTrigger={docRefresh} />
            </div>

            {/* Blockchain & Verification Details */}
            <details className="group border border-purple-200/80 rounded-xl p-3.5 bg-purple-50/20 text-xs">
              <summary className="font-bold text-purple-950 cursor-pointer flex items-center justify-between select-none list-none">
                <div className="flex items-center gap-2">
                  <span>⛓️</span>
                  <span className="font-bold text-purple-900">
                    Blockchain & Verification Proof
                  </span>
                  {isMinted && (
                    <Badge variant="purple" className="text-[10px]">
                      Sepolia ERC-721
                    </Badge>
                  )}
                </div>
                <span className="text-purple-600 group-open:rotate-180 transition-transform font-bold text-[11px]">
                  ▼
                </span>
              </summary>

              <div className="space-y-2.5 pt-3 mt-2.5 border-t border-purple-200/60">
                {isMinted ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-semibold text-[11px]">Token ID:</span>
                      <span className="font-mono text-purple-900 font-bold text-xs px-2 py-0.5 rounded bg-purple-100 border border-purple-200">
                        Token #{crop.nft_token_id}
                      </span>
                    </div>

                    {crop.nft_contract_address && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-slate-500 font-semibold text-[11px]">Contract:</span>
                        <AddressCopy value={crop.nft_contract_address} etherscanType="address" />
                      </div>
                    )}

                    {crop.nft_transaction_hash && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-slate-500 font-semibold text-[11px]">Tx Hash:</span>
                        <AddressCopy value={crop.nft_transaction_hash} etherscanType="tx" />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <a
                        href={`/crop-passport/${crop.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-lg transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Public Explorer</span>
                      </a>

                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowQR((v) => !v)}
                        className="h-7 text-xs flex items-center gap-1"
                      >
                        <QrCode className="h-3 w-3" />
                        <span>{showQR ? "Close QR" : "QR Code"}</span>
                      </Button>
                    </div>

                    {showQR && (
                      <div className="p-3 bg-white border border-purple-200 rounded-xl flex flex-col items-center gap-2 shadow-2xs animate-fade-in">
                        <div ref={qrRef} className="p-2 bg-white rounded-lg border border-slate-100">
                          <QRCodeCanvas
                            value={`${window.location.origin}/crop-passport/${crop.id}`}
                            size={120}
                            level="H"
                            includeMargin={true}
                            bgColor="#ffffff"
                            fgColor="#0f172a"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={downloadQR}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500"
                        >
                          ⬇ Download QR Code
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-purple-950">Ready for Blockchain Record</p>
                      <p className="text-[11px] text-slate-500">Record permanently on Ethereum Sepolia.</p>
                    </div>
                    <MintButton crop={crop} onMintSuccess={onMintSuccess} />
                  </div>
                )}
              </div>
            </details>
          </div>

          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setDeleteError(null);
                  setShowDeleteModal(true);
                }}
                className="flex items-center gap-1 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog (shadcn Dialog) ───────────── */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-slate-900">
                Delete Crop Passport #{crop.id}?
              </DialogTitle>
            </div>
            <DialogDescription>
              {crop.crop_name} ({crop.quantity} {crop.unit})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs text-slate-600">
            <p>
              Are you sure you want to delete this crop passport? This will remove it from your active registry.
            </p>

            {isMinted && (
              <Alert variant="default" className="border-purple-200 bg-purple-50/60 text-purple-900">
                <Info className="h-4 w-4 text-purple-700" />
                <AlertTitle className="text-purple-950">On-Chain Record Notice</AlertTitle>
                <AlertDescription className="text-purple-800 text-[11px]">
                  This crop has an ERC-721 token (#{crop.nft_token_id}) on Sepolia. Deleting this local record will not modify blockchain history.
                </AlertDescription>
              </Alert>
            )}

            {deleteError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Deletion Error</AlertTitle>
                <AlertDescription>{deleteError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting…" : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
