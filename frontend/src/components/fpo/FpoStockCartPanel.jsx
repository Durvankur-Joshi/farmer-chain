import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";

export default function FpoStockCartPanel({ onCartUpdated, onQuotePublished }) {
  const { refresh } = useRefresh();
  const [cartData, setCartData] = useState({ items: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [quantityInputs, setQuantityInputs] = useState({});

  // Quote Publishing Modal State
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    product_name: "",
    price_per_unit: "",
    deadline: "",
    description: "",
  });
  const [publishingQuote, setPublishingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  const fetchCart = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("/api/fpo/cart/", { withCredentials: true });
      setCartData(res.data || { items: [], summary: {} });
      
      // Initialize inputs for editing
      const initialInputs = {};
      (res.data?.items || []).forEach((item) => {
        initialInputs[item.id] = item.selected_quantity;
      });
      setQuantityInputs(initialInputs);

      // Pre-fill default product name if available
      if (res.data?.items?.length > 0) {
        const firstItemName = res.data.items[0].inventory_lot_details?.product_name || "";
        setQuoteForm((prev) => ({
          ...prev,
          product_name: prev.product_name || firstItemName,
        }));
      }
    } catch (err) {
      console.error("Error loading stock cart:", err);
      setError("Failed to load stock cart.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  useRefreshSubscription(["fpo", "inventory"], fetchCart);

  const handleQuantityChange = (itemId, val) => {
    setQuantityInputs((prev) => ({ ...prev, [itemId]: val }));
  };

  const handleUpdateQuantity = async (itemId) => {
    const newQty = quantityInputs[itemId];
    if (!newQty || parseFloat(newQty) <= 0) {
      alert("⚠️ Please enter a valid positive quantity greater than 0.");
      return;
    }

    setUpdatingId(itemId);
    setError("");
    try {
      await axios.patch(
        `/api/fpo/cart/items/${itemId}/`,
        { selected_quantity: newQty },
        { withCredentials: true }
      );
      await fetchCart();
      if (onCartUpdated) onCartUpdated();
      refresh(["inventory", "fpo"]);
    } catch (err) {
      console.error("Error updating cart item:", err.response?.data || err.message);
      const msg = err.response?.data?.error || "Failed to update quantity.";
      alert(`❌ ${msg}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!window.confirm("Remove this stock lot allocation from cart and release reserved inventory?")) {
      return;
    }
    setUpdatingId(itemId);
    try {
      await axios.delete(`/api/fpo/cart/items/${itemId}/delete/`, {
        withCredentials: true,
      });
      await fetchCart();
      if (onCartUpdated) onCartUpdated();
      refresh(["inventory", "fpo"]);
    } catch (err) {
      console.error("Error deleting cart item:", err);
      alert("Failed to remove item from cart.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleClearCart = async () => {
    if (!window.confirm("Clear all items from your stock cart and release all reserved stock?")) {
      return;
    }
    setLoading(true);
    try {
      await axios.delete("/api/fpo/cart/clear/", { withCredentials: true });
      await fetchCart();
      if (onCartUpdated) onCartUpdated();
      refresh(["inventory", "fpo"]);
    } catch (err) {
      console.error("Error clearing stock cart:", err);
      alert("Failed to clear cart.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublishQuoteSubmit = async (e) => {
    e.preventDefault();
    setPublishingQuote(true);
    setQuoteError("");

    const price = parseFloat(quoteForm.price_per_unit);
    if (isNaN(price) || price <= 0) {
      setQuoteError("Asking price per unit must be a positive number greater than 0.");
      setPublishingQuote(false);
      return;
    }

    if (!quoteForm.deadline) {
      setQuoteError("Please select a bidding deadline date.");
      setPublishingQuote(false);
      return;
    }

    try {
      await axios.post(
        "/api/fpo/quotes/from-cart/",
        {
          product_name: quoteForm.product_name,
          price_per_unit: quoteForm.price_per_unit,
          deadline: quoteForm.deadline,
          description: quoteForm.description,
        },
        { withCredentials: true }
      );

      alert("🎉 Wholesale market quote published successfully to retailers with full multi-farmer provenance!");
      setShowQuoteModal(false);
      setQuoteForm({ product_name: "", price_per_unit: "", deadline: "", description: "" });
      await fetchCart();
      if (onCartUpdated) onCartUpdated();
      if (onQuotePublished) onQuotePublished();
      refresh(["quotes", "inventory", "fpo", "retailer"]);
    } catch (err) {
      console.error("Error publishing quote from cart:", err.response?.data || err);
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to publish market quote.";
      setQuoteError(msg);
    } finally {
      setPublishingQuote(false);
    }
  };

  const items = cartData.items || [];
  const summary = cartData.summary || {};
  const firstItemLot = items[0]?.inventory_lot_details || {};
  const totalQtyVal = parseFloat(summary.total_selected_quantity) || 0;
  const priceVal = parseFloat(quoteForm.price_per_unit) || 0;
  const calculatedTotalEth = (totalQtyVal * priceVal).toFixed(6);

  return (
    <div className="space-y-6">
      {/* ── Section Header & Clear Action ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span>🛒</span>
            <span>FPO Stock Cart — Selected Provenance Allocations</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Partial stock reserved per farmer & Crop Passport prior to publishing wholesale market quotes.
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setQuoteError("");
                setShowQuoteModal(true);
              }}
              className="flex-1 sm:flex-none px-3.5 sm:px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🚀</span>
              <span>Publish <span className="hidden xs:inline sm:inline">Wholesale Quote</span><span className="xs:hidden">Quote</span></span>
            </button>
            <button
              type="button"
              onClick={handleClearCart}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-rose-200 flex items-center justify-center gap-1"
            >
              <span>🗑️</span>
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Cart Summary Bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-purple-50/70 to-indigo-50/50 p-4 rounded-2xl border border-purple-200/80">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Total Selected Stock</span>
          <span className="text-2xl font-extrabold text-purple-900 font-mono mt-1 block truncate">
            {summary.total_selected_quantity || "0"} units
          </span>
        </div>

        <div className="bg-gradient-to-br from-blue-50/70 to-cyan-50/50 p-4 rounded-2xl border border-blue-200/80">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Lot Allocations</span>
          <span className="text-2xl font-extrabold text-blue-900 font-mono mt-1 block">
            {summary.total_items_count || 0}
          </span>
        </div>

        <div className="bg-gradient-to-br from-emerald-50/70 to-green-50/50 p-4 rounded-2xl border border-emerald-200/80">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Farmer Sources</span>
          <span className="text-2xl font-extrabold text-emerald-900 font-mono mt-1 block">
            {summary.unique_farmers_count || 0}
          </span>
        </div>

        <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/50 p-4 rounded-2xl border border-amber-200/80">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Crop Passports</span>
          <span className="text-2xl font-extrabold text-amber-900 font-mono mt-1 block">
            {summary.unique_passports_count || 0}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* ── Cart Items List ─────────────────────────────────────────── */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 animate-pulse space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded mx-auto" />
          <p>Loading reserved stock cart items…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
          <span className="text-4xl block">🛒</span>
          <h3 className="text-sm font-extrabold text-slate-800">Your Stock Cart is Empty</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Select available inventory lots in the "Stock Inventory & Provenance" tab to reserve partial stock quantities per farmer and crop passport.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const lot = item.inventory_lot_details || {};
            const farmer = lot.farmer_details || {};
            const cp = lot.crop_passport_details;
            const currentInput = quantityInputs[item.id] ?? item.selected_quantity;
            const isModified = String(currentInput) !== String(item.selected_quantity);

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-purple-300 transition-all space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left: Product & Provenance Details */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-extrabold text-slate-900 truncate">
                        {lot.product_name || "Crop Stock"}
                      </span>
                      {lot.crop_category && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          {lot.crop_category}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-slate-400">
                        Lot #{lot.id}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <div className="truncate">
                        <strong className="text-slate-400 font-semibold">Source Farmer:</strong>{" "}
                        <span className="font-extrabold text-slate-800">{farmer.name || lot.farmer_name}</span>{" "}
                        <span className="text-slate-400">({farmer.city || lot.farmer_city}, {farmer.state || lot.farmer_state})</span>
                      </div>
                      {cp ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 font-bold flex-wrap">
                          <span>✓ Passport #{cp.id}</span>
                          {cp.is_minted && <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded border border-purple-200">NFT</span>}
                          {cp.ai_verification?.quality_grade && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                              Grade {cp.ai_verification.quality_grade}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Direct Harvest (No Passport)</span>
                      )}
                    </div>

                    {/* Stock Metrics Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100 text-xs">
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Original Lot</span>
                        <span className="font-semibold text-slate-700 font-mono mt-0.5 block truncate">
                          {lot.original_quantity} {lot.unit}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Available</span>
                        <span className="font-semibold text-emerald-700 font-mono mt-0.5 block truncate">
                          {lot.available_quantity} {lot.unit}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Selected</span>
                        <span className="font-extrabold text-purple-700 font-mono mt-0.5 block truncate">
                          {item.selected_quantity} {lot.unit}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Acq. Price</span>
                        <span className="font-semibold text-slate-700 font-mono mt-0.5 block truncate">
                          {lot.acquisition_price ? `${lot.acquisition_price} ETH/${lot.unit}` : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quantity Selector & Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full sm:w-auto pt-2 md:pt-0">
                    <div className="w-full sm:w-36">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Select Quantity ({lot.unit})
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          min="0.000001"
                          max={parseFloat(lot.available_quantity) + parseFloat(item.selected_quantity)}
                          value={currentInput}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-extrabold text-slate-900 focus:bg-white focus:border-purple-500 outline-none"
                        />
                        {isModified && (
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id)}
                            disabled={updatingId === item.id}
                            className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0"
                          >
                            Save
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={updatingId === item.id}
                      className="w-full sm:w-auto px-3 py-2 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 border border-slate-200 hover:border-rose-300 self-end sm:self-auto mt-auto"
                    >
                      <span>✕</span>
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Publish Wholesale Market Quote Modal ────────────────────── */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handlePublishQuoteSubmit}
            className="bg-white rounded-3xl max-w-xl w-full p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl border border-slate-200 animate-fade-in max-h-[92vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🚀</span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Publish Wholesale Quote to Retailers
                  </h3>
                  <p className="text-xs text-slate-500">
                    Creates a commercial quote directly backed by your {summary.total_items_count} cart lot allocation(s).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuoteModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {quoteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                ⚠️ {quoteError}
              </div>
            )}

            {/* Cart Allocation Summary Box */}
            <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-900">Selected Stock Summary:</span>
                <span className="font-extrabold text-purple-950 font-mono text-sm">
                  {summary.total_selected_quantity} {firstItemLot.unit || "kg"}
                </span>
              </div>

              <div className="border-t border-purple-200/60 pt-2 space-y-1 text-slate-700">
                <div className="font-semibold text-purple-950 text-[11px]">Provenance Allocations Breakdown:</div>
                {items.map((item, idx) => {
                  const lot = item.inventory_lot_details || {};
                  const farmer = lot.farmer_details || {};
                  const cp = lot.crop_passport_details;

                  return (
                    <div key={item.id} className="flex justify-between items-center text-[11px]">
                      <span>
                        #{idx + 1}. {farmer.name || lot.farmer_name} {cp ? `(Passport #${cp.id})` : ''}
                      </span>
                      <span className="font-mono font-bold text-purple-900">
                        {item.selected_quantity} {lot.unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quote Form Inputs */}
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Commercial Product Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Sharbati Wheat Wholesale Batch"
                  value={quoteForm.product_name}
                  onChange={(e) => setQuoteForm({ ...quoteForm, product_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-purple-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Asking Price (ETH per {firstItemLot.unit || "unit"}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.000001"
                    required
                    placeholder="e.g. 0.05"
                    value={quoteForm.price_per_unit}
                    onChange={(e) => setQuoteForm({ ...quoteForm, price_per_unit: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-extrabold text-slate-900 focus:bg-white focus:border-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bidding Deadline *</label>
                  <input
                    type="date"
                    required
                    value={quoteForm.deadline}
                    onChange={(e) => setQuoteForm({ ...quoteForm, deadline: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              {priceVal > 0 && totalQtyVal > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-emerald-900">Estimated Total Wholesale Value:</span>
                  <span className="font-extrabold text-emerald-900 font-mono text-sm">
                    {calculatedTotalEth} ETH
                  </span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Packaging & Dispatch Notes</label>
                <textarea
                  rows="2"
                  placeholder="FPO warehouse location, packing specifications, dispatch readiness…"
                  value={quoteForm.description}
                  onChange={(e) => setQuoteForm({ ...quoteForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-purple-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowQuoteModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={publishingQuote}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>🚀</span>
                <span>{publishingQuote ? "Publishing…" : "Publish Market Quote"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
