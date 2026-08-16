import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import ProvenanceCard from "../common/ProvenanceCard";

export default function RetailerInventoryPanel() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div className="space-y-6">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-6 rounded-3xl shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📦</span>
            <h2 className="text-lg font-extrabold">Purchased Retailer Stock Inventory</h2>
          </div>
          <p className="text-xs text-purple-100/80 mt-1 max-w-xl">
            Crops successfully acquired from FPOs after Sepolia smart-contract escrow payment release. Retains 100% end-to-end farmer provenance.
          </p>
        </div>
        <div className="bg-purple-800/60 border border-purple-400/30 px-4 py-2 rounded-2xl text-center shrink-0">
          <span className="text-[10px] text-purple-200 uppercase font-extrabold block">Acquired Stock Lots</span>
          <span className="text-xl font-extrabold font-mono text-white">{inventory.length}</span>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 animate-pulse space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded mx-auto" />
          <p>Loading your verified stock inventory…</p>
        </div>
      ) : inventory.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-3xl border border-slate-200/80 space-y-3">
          <span className="text-4xl block">🌾</span>
          <h3 className="text-sm font-extrabold text-slate-800">No Purchased Inventory Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Once an FPO → Retailer deal completes and payment is released on-chain, your acquired crop lots with full farmer provenance will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {inventory.map((lot) => {
            const cp = lot.crop_passport_details;
            return (
              <div
                key={lot.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:border-purple-300 transition-all space-y-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-extrabold text-slate-900">{lot.product_name}</span>
                      {lot.crop_category && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          {lot.crop_category}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Supplier: <strong className="text-slate-800">{lot.fpo_name}</strong>
                    </p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-800 font-extrabold text-[10px] uppercase px-2.5 py-1 rounded-full border border-emerald-300">
                    In Stock
                  </span>
                </div>

                {/* Grid Info */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Quantity</span>
                    <span className="font-extrabold text-purple-900 mt-0.5 block">{lot.quantity} {lot.unit}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Unit Price</span>
                    <span className="font-semibold text-blue-700 mt-0.5 block">{lot.purchase_price_per_unit} ETH</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Paid</span>
                    <span className="font-extrabold text-emerald-700 mt-0.5 block">{lot.total_price} ETH</span>
                  </div>
                  {lot.escrow && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Escrow ID</span>
                      <span className="font-semibold text-slate-700 mt-0.5 block">#{lot.escrow}</span>
                    </div>
                  )}
                  {lot.created_at && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Purchased</span>
                      <span className="font-semibold text-slate-700 mt-0.5 block">{new Date(lot.created_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Single Farmer & Passport Breakdown for this lot */}
                {lot.farmer_name && (
                <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-extrabold text-slate-900 text-xs">👨‍🌾 Source Farmer: {lot.farmer_name}</p>
                      {lot.farmer_location && (
                        <p className="text-[10px] text-slate-500 font-medium">📍 {lot.farmer_location}</p>
                      )}
                    </div>
                    <span className="font-mono text-purple-900 font-bold bg-purple-100 px-2 py-0.5 rounded text-[10px]">
                      {lot.quantity} {lot.unit}
                    </span>
                  </div>

                  {cp && (
                    <div className="flex items-center justify-between pt-1 border-t border-purple-200/60 text-[10px]">
                      <a
                        href={`/crop-passport/${cp.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200 text-[10px]"
                      >
                        <span>📜</span>
                        <span>View Crop Passport #{cp.id} 🔗</span>
                      </a>
                      {cp.ai_verification?.quality_grade && (
                        <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          Grade {cp.ai_verification.quality_grade}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
