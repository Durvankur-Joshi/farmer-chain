import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import StatusBadge from "../common/StatusBadge";
import AddressCopy from "../common/AddressCopy";

const UNIT_OPTIONS = ["All Units", "kg", "quintal", "caret", "piece", "acre", "ton", "litre", "dozen"];
const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
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
  const [activeProvenanceLot, setActiveProvenanceLot] = useState(null);
  const [selectedQtyInputs, setSelectedQtyInputs] = useState({});
  const [reservingId, setReservingId] = useState(null);

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
      setLots(res.data);
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

  const handleAddToCart = async (lot) => {
    const qty = selectedQtyInputs[lot.id];
    if (!qty || parseFloat(qty) <= 0) {
      alert(`⚠️ Please enter a positive quantity in ${lot.unit} to reserve.`);
      return;
    }

    if (parseFloat(qty) > parseFloat(lot.available_quantity)) {
      alert(`⚠️ Selected quantity (${qty} ${lot.unit}) exceeds available stock (${lot.available_quantity} ${lot.unit}).`);
      return;
    }

    setReservingId(lot.id);
    setError("");
    try {
      await axios.post(
        "/api/fpo/cart/items/",
        {
          inventory_lot_id: lot.id,
          selected_quantity: qty,
        },
        { withCredentials: true }
      );

      // Clear input and refresh inventory list
      setSelectedQtyInputs((prev) => ({ ...prev, [lot.id]: "" }));
      fetchInventory();
      if (onCartUpdated) onCartUpdated();
      refresh(["inventory", "fpo"]);
    } catch (err) {
      console.error("Error adding to stock cart:", err.response?.data || err.message);
      const msg = err.response?.data?.error || "Failed to reserve stock in cart.";
      alert(`❌ ${msg}`);
    } finally {
      setReservingId(null);
    }
  };

  // Derive categories from available lots for filtering
  const categories = ["all", ...Array.from(new Set(lots.map((l) => l.crop_category).filter(Boolean)))];

  // Overview calculations
  const totalAvailableStock = lots.reduce((acc, lot) => {
    const qty = parseFloat(lot.available_quantity) || 0;
    return acc + qty;
  }, 0);

  return (
    <div className="space-y-6">
      {/* ── Section Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span>📦</span>
            <span>FPO Inventory Stock Lots & Provenance</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Traceable inventory acquired from farmers — retains permanent farmer and Crop Passport provenance.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchInventory}
          className="self-start sm:self-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>🔄</span>
          <span>Refresh Stock</span>
        </button>
      </div>

      {/* ── Summary Stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 p-4 rounded-2xl border border-blue-200/70">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Total Lots</span>
          <span className="text-2xl font-extrabold text-blue-900 font-mono mt-1 block">{lots.length}</span>
        </div>
        <div className="bg-gradient-to-br from-emerald-50/60 to-green-50/40 p-4 rounded-2xl border border-emerald-200/70">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Available Lots</span>
          <span className="text-2xl font-extrabold text-emerald-900 font-mono mt-1 block">
            {lots.filter((l) => l.status === "available").length}
          </span>
        </div>
        <div className="bg-gradient-to-br from-purple-50/60 to-violet-50/40 p-4 rounded-2xl border border-purple-200/70">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Passport Provenance</span>
          <span className="text-2xl font-extrabold text-purple-900 font-mono mt-1 block">
            {lots.filter((l) => l.crop_passport).length} / {lots.length}
          </span>
        </div>
        <div className="bg-gradient-to-br from-amber-50/60 to-orange-50/40 p-4 rounded-2xl border border-amber-200/70">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Total Quantity</span>
          <span className="text-xl font-extrabold text-amber-900 font-mono mt-1 block truncate">
            {totalAvailableStock.toLocaleString()} units
          </span>
        </div>
      </div>

      {/* ── Search & Filter Controls ──────────────────────────────── */}
      <div className="bg-slate-50/70 border border-slate-200/80 p-3.5 rounded-2xl flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search crop, category, farmer name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-pointer"
        >
          <option value="all">All Categories</option>
          {categories.filter((c) => c !== "all").map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-pointer"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* ── Inventory Lots Grid ───────────────────────────────────── */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 animate-pulse space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded mx-auto" />
          <p>Loading FPO stock inventory & provenance records…</p>
        </div>
      ) : lots.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
          <span className="text-4xl block">📦</span>
          <h3 className="text-sm font-extrabold text-slate-800">No Inventory Stock Lots Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            When you accept farmer supply quotes and acquire crop lots, stock inventory with full farmer provenance will automatically appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lots.map((lot) => {
            const cp = lot.crop_passport_details;
            const isAvailable = lot.status === "available";

            return (
              <div
                key={lot.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:border-blue-300 transition-all space-y-4 relative"
              >
                {/* Lot Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold text-slate-900 truncate">{lot.product_name}</span>
                      {lot.crop_category && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                          {lot.crop_category}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      Lot #{lot.id} · Acquired from {lot.farmer_name}
                    </p>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border shrink-0 ${
                      isAvailable
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : lot.status === "reserved"
                        ? "bg-amber-50 text-amber-800 border-amber-300"
                        : "bg-slate-100 text-slate-500 border-slate-300"
                    }`}
                  >
                    {lot.status}
                  </span>
                </div>

                {/* Stock Quantities & Unit */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-2.5 sm:p-3 rounded-xl border border-slate-100 text-xs">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Available</span>
                    <span className="font-extrabold text-emerald-700 font-mono mt-0.5 block truncate">
                      {lot.available_quantity} {lot.unit}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Original</span>
                    <span className="font-semibold text-slate-700 font-mono mt-0.5 block truncate">
                      {lot.original_quantity} {lot.unit}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Acq. Price</span>
                    <span className="font-semibold text-purple-700 font-mono mt-0.5 block truncate">
                      {lot.acquisition_price ? `${lot.acquisition_price} ETH/${lot.unit}` : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Provenance Quick Badges */}
                <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-slate-600">
                    <span className="text-[11px] font-semibold text-slate-400">Source Farmer:</span>
                    <span className="font-bold text-slate-800 text-right">{lot.farmer_name} ({lot.farmer_city}, {lot.farmer_state})</span>
                  </div>

                  {lot.farmer_did && (
                    <div className="flex flex-wrap items-center justify-between gap-1 text-slate-600">
                      <span className="text-[11px] font-semibold text-slate-400">Farmer DID:</span>
                      <AddressCopy value={lot.farmer_did} address={lot.farmer_did} truncateLength={14} />
                    </div>
                  )}

                  {cp ? (
                    <div className="flex flex-wrap items-center justify-between gap-1 text-slate-600">
                      <span className="text-[11px] font-semibold text-slate-400">Crop Passport:</span>
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold flex-wrap">
                        <span>✓ Passport #{cp.id}</span>
                        {cp.is_minted && <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded border border-purple-200">NFT</span>}
                        {cp.ai_verification?.quality_grade && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                            Grade {cp.ai_verification.quality_grade}
                          </span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-[11px] font-semibold text-slate-400">Crop Passport:</span>
                      <span className="text-slate-400 italic">Direct Quote (No Passport)</span>
                    </div>
                  )}
                </div>

                {/* Stock Allocation & Cart Reservation Controls */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
                    <input
                      type="number"
                      step="any"
                      min="0.000001"
                      max={lot.available_quantity}
                      placeholder={`Qty in ${lot.unit}`}
                      value={selectedQtyInputs[lot.id] || ""}
                      onChange={(e) => setSelectedQtyInputs({ ...selectedQtyInputs, [lot.id]: e.target.value })}
                      disabled={parseFloat(lot.available_quantity) <= 0 || reservingId === lot.id}
                      className="w-full sm:w-32 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-500 outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddToCart(lot)}
                      disabled={parseFloat(lot.available_quantity) <= 0 || reservingId === lot.id}
                      className="w-full sm:w-auto px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      <span>🛒</span>
                      <span>{reservingId === lot.id ? "Reserving…" : "Reserve in Cart"}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveProvenanceLot(lot)}
                    className="w-full sm:w-auto px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 border border-blue-200 shrink-0"
                  >
                    <span>🔍</span>
                    <span>Trace Provenance</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Provenance Traceability Modal ─────────────────────────── */}
      {activeProvenanceLot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl border border-slate-200 animate-fade-in max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔗</span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Provenance Chain: Lot #{activeProvenanceLot.id}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Complete traceability record from farmer harvest to FPO stock
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveProvenanceLot(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Trace Step 1: FPO Stock Lot */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center text-xs font-extrabold text-blue-900">
                <span>🏢 STEP 1 — FPO HOLDER</span>
                <span className="font-mono text-[11px] text-blue-700">LOT #{activeProvenanceLot.id}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">FPO Name</span>
                  <span className="font-bold text-slate-800">{activeProvenanceLot.fpo_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Available Stock</span>
                  <span className="font-extrabold font-mono text-emerald-700">
                    {activeProvenanceLot.available_quantity} / {activeProvenanceLot.original_quantity} {activeProvenanceLot.unit}
                  </span>
                </div>
              </div>
            </div>

            {/* Trace Step 2: Source Farmer */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center text-xs font-extrabold text-emerald-900">
                <span>🌾 STEP 2 — SOURCE FARMER</span>
                <span className="text-[11px] text-emerald-700">Producer</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Farmer Name</span>
                  <span className="font-bold text-slate-800">{activeProvenanceLot.farmer_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Location</span>
                  <span className="font-semibold text-slate-800">
                    {activeProvenanceLot.farmer_city}, {activeProvenanceLot.farmer_state}
                  </span>
                </div>
              </div>
              {activeProvenanceLot.farmer_did && (
                <div className="text-xs pt-1 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Farmer W3C DID:</span>
                  <AddressCopy value={activeProvenanceLot.farmer_did} address={activeProvenanceLot.farmer_did} truncateLength={22} />
                </div>
              )}
            </div>

            {/* Trace Step 3: Crop Passport twin if present */}
            {activeProvenanceLot.crop_passport_details ? (
              <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs font-extrabold text-purple-900">
                  <span>📜 STEP 3 — CROP PASSPORT TWIN</span>
                  <span className="text-[11px] text-purple-700 font-mono">PASSPORT #{activeProvenanceLot.crop_passport_details.id}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Crop Name</span>
                    <span className="font-extrabold text-slate-900">{activeProvenanceLot.crop_passport_details.crop_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Harvest Date</span>
                    <span className="font-semibold text-slate-800">{activeProvenanceLot.crop_passport_details.harvest_date}</span>
                  </div>
                </div>

                {activeProvenanceLot.crop_passport_details.primary_image_url && (
                  <img
                    src={activeProvenanceLot.crop_passport_details.primary_image_url}
                    alt={activeProvenanceLot.crop_passport_details.crop_name}
                    className="w-full h-32 object-cover rounded-xl border border-purple-200"
                  />
                )}

                {activeProvenanceLot.crop_passport_details.ai_verification && (
                  <div className="bg-white p-3 rounded-xl border border-purple-200 space-y-1 text-xs">
                    <span className="text-[10px] font-bold text-purple-700 uppercase block">🤖 AI Quality Assessment</span>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-emerald-700">
                        Grade {activeProvenanceLot.crop_passport_details.ai_verification.quality_grade}
                      </span>
                      <span className="text-slate-600 font-mono text-[11px]">
                        Score: {activeProvenanceLot.crop_passport_details.ai_verification.quality_score}/100
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 italic">
                ℹ️ Direct harvest quote (No Crop Passport attached to this specific stock lot).
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveProvenanceLot(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Close Provenance Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
