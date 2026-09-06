import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import AddressCopy from "../common/AddressCopy";
import BaseModal from "../common/BaseModal";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "available", label: "Available Stock" },
  { value: "reserved", label: "Reserved Stock" },
  { value: "depleted", label: "Depleted" },
];

export default function FpoInventoryPanel({ onCartUpdated, refreshTrigger }) {
  const { refresh } = useRefresh();
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Modals state
  const [activeLotsModal, setActiveLotsModal] = useState(null);
  const [cartModalLot, setCartModalLot] = useState(null);
  const [reserveQtyInput, setReserveQtyInput] = useState("");
  const [reserving, setReserving] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedCategory !== "all") params.category = selectedCategory;
      if (selectedStatus !== "all") params.status = selectedStatus;

      const res = await axios.get("/api/fpo/inventory/", {
        params,
        withCredentials: true,
      });
      setLots(res.data || []);
    } catch (err) {
      console.error("Error loading FPO inventory:", err);
      setError("Could not load inventory lots.");
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedStatus]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory, refreshTrigger]);

  useRefreshSubscription(["inventory", "fpo", "deals", "quotes"], fetchInventory);

  const handleOpenCartModal = (lot) => {
    setCartModalLot(lot);
    setReserveQtyInput(lot.available_quantity || "");
  };

  const handleReserveInCart = async (e) => {
    if (e) e.preventDefault();
    if (!cartModalLot) return;

    const qty = parseFloat(reserveQtyInput);
    if (!qty || isNaN(qty) || qty <= 0) {
      alert(`⚠️ Please enter a positive quantity in ${cartModalLot.unit} to reserve.`);
      return;
    }

    if (qty > parseFloat(cartModalLot.available_quantity)) {
      alert(`⚠️ Selected quantity (${qty} ${cartModalLot.unit}) exceeds available stock (${cartModalLot.available_quantity} ${cartModalLot.unit}).`);
      return;
    }

    setReserving(true);
    try {
      await axios.post(
        "/api/fpo/cart/items/",
        {
          inventory_lot_id: cartModalLot.id,
          selected_quantity: qty,
        },
        { withCredentials: true }
      );

      setCartModalLot(null);
      setReserveQtyInput("");
      fetchInventory();
      if (onCartUpdated) onCartUpdated();
      refresh(["inventory", "fpo"]);
    } catch (err) {
      console.error("Error adding to stock cart:", err.response?.data || err.message);
      const msg = err.response?.data?.error || "Failed to reserve stock in cart.";
      alert(`❌ ${msg}`);
    } finally {
      setReserving(false);
    }
  };

  const categories = ["all", ...Array.from(new Set(lots.map((l) => l.crop_category).filter(Boolean)))];

  const totalAvailableStock = lots.reduce((acc, lot) => {
    const qty = parseFloat(lot.available_quantity) || 0;
    return acc + qty;
  }, 0);

  return (
    <div className="space-y-4">
      {/* ── Search & Filter Controls ──────────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search inventory by crop, category, or farmer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.filter((c) => c !== "all").map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-pointer"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <span className="hidden md:inline-flex text-[11px] font-mono font-bold text-slate-700 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
            Total: {totalAvailableStock.toLocaleString()} units
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* ── Compact Inventory Lots Grid ───────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 animate-pulse space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              <div className="h-3 bg-slate-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : lots.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
          <span className="text-4xl block">📦</span>
          <h3 className="text-sm font-extrabold text-slate-800">No Inventory Stock Lots Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Procured lots from farmers will appear here with complete provenance records preserved.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {lots.map((lot) => {
            const cp = lot.crop_passport_details;
            const aiGrade = cp?.ai_verification?.quality_grade || cp?.ai_grade;
            const isAvailable = lot.status === "available" && parseFloat(lot.available_quantity) > 0;

            return (
              <div
                key={lot.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-4.5 hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between gap-3 min-w-0"
              >
                <div className="space-y-2 min-w-0">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
                          {lot.product_name}
                        </h4>
                        {lot.crop_category && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                            {lot.crop_category}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        Lot #{lot.id} · From {lot.farmer_name}
                      </p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border shrink-0 ${
                        isAvailable
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {lot.status}
                    </span>
                  </div>

                  {/* Stock Quantity & Quality Grade */}
                  <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Stock Available</span>
                      <span className="font-extrabold text-slate-900 font-mono text-sm">
                        {lot.available_quantity} <span className="text-xs text-slate-500 font-sans font-normal">{lot.unit}</span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Quality Grade</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                        {aiGrade ? `Grade ${aiGrade}` : "Standard"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: View Lots & Reserve Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveLotsModal(lot)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <span>📜</span>
                    <span>View Lots</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenCartModal(lot)}
                    disabled={!isAvailable}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    <span>🛒</span>
                    <span>Reserve Stock</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── View Lots Modal (Preserving Complete Provenance) ───────── */}
      {activeLotsModal && (
        <BaseModal
          isOpen={Boolean(activeLotsModal)}
          onClose={() => setActiveLotsModal(null)}
          title={`Inventory Lot Breakdown: ${activeLotsModal.product_name}`}
          subtitle={`Lot #${activeLotsModal.id} · Total: ${activeLotsModal.original_quantity} ${activeLotsModal.unit}`}
          icon="📦"
          maxWidth="max-w-xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setActiveLotsModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const l = activeLotsModal;
                  setActiveLotsModal(null);
                  handleOpenCartModal(l);
                }}
                disabled={parseFloat(activeLotsModal.available_quantity) <= 0}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span>🛒</span>
                <span>Reserve in Stock Cart</span>
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Provenance Lots List */}
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Underlying Farmer Harvest Lots
              </span>

              {/* Farmer Source Lot Breakdown (Preserves Provenance) */}
              <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-extrabold text-slate-900 text-xs">
                      👨‍🌾 {activeLotsModal.farmer_name}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      📍 {activeLotsModal.farmer_city}, {activeLotsModal.farmer_state}
                    </p>
                  </div>
                  <span className="font-extrabold font-mono text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-emerald-200 text-xs">
                    {activeLotsModal.available_quantity} / {activeLotsModal.original_quantity} {activeLotsModal.unit}
                  </span>
                </div>

                {activeLotsModal.farmer_did && (
                  <div className="pt-1.5 border-t border-emerald-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Farmer W3C DID:</span>
                    <AddressCopy value={activeLotsModal.farmer_did} truncateLength={18} />
                  </div>
                )}
              </div>
            </div>

            {/* Passport & AI Grade Details if available */}
            {activeLotsModal.crop_passport_details ? (
              <div className="p-3.5 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                    📜 Linked Crop Passport Twin
                  </span>
                  <span className="font-mono text-purple-900 font-extrabold text-xs">
                    #{activeLotsModal.crop_passport_details.id}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Harvest Date:</span>
                    <span className="font-semibold text-slate-800">
                      {activeLotsModal.crop_passport_details.harvest_date || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Quality Assessment:</span>
                    <span className="font-bold text-emerald-700">
                      Grade {activeLotsModal.crop_passport_details.ai_verification?.quality_grade || "Verified"}
                    </span>
                  </div>
                </div>

                {activeLotsModal.crop_passport_details.primary_image_url && (
                  <img
                    src={activeLotsModal.crop_passport_details.primary_image_url}
                    alt={activeLotsModal.product_name}
                    className="w-full h-32 object-cover rounded-xl border border-purple-200 shadow-xs mt-1"
                  />
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 italic text-center">
                Direct harvest lot acquired via FPO procurement bid.
              </div>
            )}
          </div>
        </BaseModal>
      )}

      {/* ── Reserve Stock in Cart Modal ─────────────────────────────── */}
      {cartModalLot && (
        <BaseModal
          isOpen={Boolean(cartModalLot)}
          onClose={() => setCartModalLot(null)}
          title={`Reserve Stock: ${cartModalLot.product_name}`}
          subtitle={`Lot #${cartModalLot.id} · Available: ${cartModalLot.available_quantity} ${cartModalLot.unit}`}
          icon="🛒"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleReserveInCart} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Source Farmer:</span>
                <span className="font-bold text-slate-900">{cartModalLot.farmer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Available Stock:</span>
                <span className="font-mono font-bold text-slate-900">{cartModalLot.available_quantity} {cartModalLot.unit}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Quantity to Reserve for Wholesale ({cartModalLot.unit}) *
              </label>
              <input
                type="number"
                step="any"
                min="0.000001"
                max={cartModalLot.available_quantity}
                required
                value={reserveQtyInput}
                onChange={(e) => setReserveQtyInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCartModalLot(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reserving || !reserveQtyInput || parseFloat(reserveQtyInput) <= 0}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span>🛒</span>
                <span>{reserving ? "Reserving…" : "Confirm Reservation"}</span>
              </button>
            </div>
          </form>
        </BaseModal>
      )}
    </div>
  );
}
