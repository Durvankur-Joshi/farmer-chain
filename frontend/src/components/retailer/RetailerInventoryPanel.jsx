import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useRefreshSubscription } from "../../context/useRefresh";
import BaseModal from "../common/BaseModal";
import AddressCopy from "../common/AddressCopy";

export default function RetailerInventoryPanel() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLotModal, setSelectedLotModal] = useState(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("/api/retailer/inventory/", { withCredentials: true });
      setInventory(res.data?.inventory || []);
    } catch (err) {
      console.error("Error loading retailer inventory:", err);
      setError("Failed to load your purchased crop inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useRefreshSubscription(["retailer", "inventory", "deals", "escrow"], fetchInventory);

  return (
    <div className="space-y-5">
      {/* ── Surface Panel Header ───────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xl">📦</span>
            <h2 className="text-base font-extrabold text-slate-900">Purchased Retailer Stock Inventory</h2>
            <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
              Permanent Stock
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-xl">
            Acquired bulk inventory from FPO partners after on-chain escrow release. Permanent stock retaining full farmer & crop passport provenance (distinct from active cart).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <span className="text-xs font-semibold text-slate-500">Total Lots:</span>
          <span className="text-sm font-extrabold font-mono text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-xl">
            {inventory.length}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-8 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : inventory.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-2">
          <span className="text-4xl block">🌾</span>
          <h3 className="text-sm font-extrabold text-slate-800">No Purchased Inventory Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Once an FPO → Retailer deal completes and payment is released on-chain via smart contracts, your acquired crop lots with full farmer provenance will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {inventory.map((lot) => {
            const cp = lot.crop_passport_details;
            const qualityGrade = cp?.ai_verification?.quality_grade || cp?.quality_grade;

            return (
              <div
                key={lot.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-purple-300 transition-all flex flex-col justify-between gap-3 min-w-0"
              >
                <div className="space-y-3 min-w-0">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-extrabold text-slate-900 truncate">{lot.product_name}</span>
                        {lot.crop_category && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                            {lot.crop_category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        Supplier: <strong className="text-slate-800 font-semibold">{lot.fpo_name}</strong>
                      </p>
                    </div>
                    <span className="bg-emerald-50 text-emerald-800 font-extrabold text-[10px] uppercase px-2.5 py-1 rounded-full border border-emerald-300 shrink-0">
                      In Stock
                    </span>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100 text-xs">
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Quantity</span>
                      <span className="font-extrabold text-purple-900 font-mono mt-0.5 block truncate">{lot.quantity} {lot.unit}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Unit Rate</span>
                      <span className="font-semibold text-blue-700 font-mono mt-0.5 block truncate">{lot.purchase_price_per_unit} ETH</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Total Paid</span>
                      <span className="font-extrabold text-emerald-700 font-mono mt-0.5 block truncate">{lot.total_price} ETH</span>
                    </div>
                    {lot.escrow && (
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Escrow ID</span>
                        <span className="font-semibold text-slate-700 font-mono mt-0.5 block truncate">#{lot.escrow}</span>
                      </div>
                    )}
                    {lot.created_at && (
                      <div className="min-w-0 col-span-2 sm:col-span-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Settled On</span>
                        <span className="font-medium text-slate-600 mt-0.5 block truncate">{new Date(lot.created_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Source Farmer Quick Preview */}
                  {lot.farmer_name && (
                    <div className="flex items-center justify-between text-xs p-2 bg-purple-50/50 rounded-xl border border-purple-100/80">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-sm shrink-0">👨‍🌾</span>
                        <span className="text-slate-600 truncate">
                          Farmer: <strong className="text-slate-900 font-semibold">{lot.farmer_name}</strong>
                          {lot.farmer_location && <span className="text-slate-500 font-normal"> ({lot.farmer_location})</span>}
                        </span>
                      </div>
                      {qualityGrade && (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                          Grade {qualityGrade}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">Lot #{lot.id}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedLotModal(lot)}
                    className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold rounded-xl border border-purple-200 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>📜</span>
                    <span>View Provenance</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Lot Provenance Details Modal ────────────────────────────── */}
      {selectedLotModal && (
        <BaseModal
          isOpen={Boolean(selectedLotModal)}
          onClose={() => setSelectedLotModal(null)}
          title={`Inventory Lot Provenance: ${selectedLotModal.product_name}`}
          subtitle={`Acquired Stock #${selectedLotModal.id} · Supplier: ${selectedLotModal.fpo_name}`}
          icon="📦"
          maxWidth="max-w-xl"
          footer={
            <div className="flex justify-end w-full">
              <button
                type="button"
                onClick={() => setSelectedLotModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Lot Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Stock Volume</span>
                <span className="font-extrabold text-slate-900 mt-0.5 block">{selectedLotModal.quantity} {selectedLotModal.unit}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Unit Price</span>
                <span className="font-semibold text-blue-700 mt-0.5 block">{selectedLotModal.purchase_price_per_unit} ETH</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Total Paid</span>
                <span className="font-extrabold text-emerald-700 mt-0.5 block">{selectedLotModal.total_price} ETH</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Escrow Deal</span>
                <span className="font-semibold text-purple-700 mt-0.5 block">#{selectedLotModal.escrow || "N/A"}</span>
              </div>
            </div>

            {/* Source Farmer Details */}
            <div className="p-3.5 bg-purple-50/60 border border-purple-200/70 rounded-2xl space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-900 block">
                👨‍🌾 Original Producer Lineage
              </span>
              <div className="space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Producer Name:</span>
                  <span className="font-bold text-slate-900">{selectedLotModal.farmer_name || "Verified Farmer"}</span>
                </div>
                {selectedLotModal.farmer_location && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Farm Location:</span>
                    <span className="font-semibold text-slate-800">{selectedLotModal.farmer_location}</span>
                  </div>
                )}
                {selectedLotModal.crop_passport_details?.farmer_did && (
                  <div className="flex justify-between items-center pt-1 border-t border-purple-200/60">
                    <span className="text-slate-500">Farmer DID:</span>
                    <AddressCopy address={selectedLotModal.crop_passport_details.farmer_did} />
                  </div>
                )}
              </div>
            </div>

            {/* Crop Passport Verification */}
            {selectedLotModal.crop_passport_details && (
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/70 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 block">
                    📜 Verified Crop Passport
                  </span>
                  {selectedLotModal.crop_passport_details.ai_verification?.quality_grade && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
                      Quality Grade {selectedLotModal.crop_passport_details.ai_verification.quality_grade}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500">Passport ID: #{selectedLotModal.crop_passport_details.id}</span>
                  <a
                    href={`/crop-passport/${selectedLotModal.crop_passport_details.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-white hover:bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-300 shadow-2xs transition-all text-xs"
                  >
                    <span>Inspect Passport Certificate 🔗</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </BaseModal>
      )}
    </div>
  );
}
