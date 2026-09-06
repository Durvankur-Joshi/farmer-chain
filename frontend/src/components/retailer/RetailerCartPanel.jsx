import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import ProvenanceCard from "../common/ProvenanceCard";

export default function RetailerCartPanel({ onCartUpdated, onOrderCreated }) {
  const { refresh } = useRefresh();
  const [cartData, setCartData] = useState({ items: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [quantityInputs, setQuantityInputs] = useState({});

  // Order creation modal
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");

  const fetchCart = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("/api/retailer/cart/", { withCredentials: true });
      setCartData(res.data || { items: [], summary: {} });
      
      const initialInputs = {};
      (res.data?.items || []).forEach((item) => {
        initialInputs[item.id] = item.selected_quantity;
      });
      setQuantityInputs(initialInputs);
    } catch (err) {
      console.error("Error loading retailer cart:", err);
      setError("Failed to load retailer cart.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  useRefreshSubscription(["retailer", "inventory", "quotes"], fetchCart);

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
        `/api/retailer/cart/items/${itemId}/`,
        { selected_quantity: newQty },
        { withCredentials: true }
      );
      await fetchCart();
      if (onCartUpdated) onCartUpdated();
      refresh(["retailer", "inventory", "quotes"]);
    } catch (err) {
      console.error("Error updating cart item:", err.response?.data || err.message);
      const msg = err.response?.data?.error || "Failed to update quantity.";
      alert(`❌ ${msg}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!window.confirm("Remove this FPO quote reservation from your cart and release reserved stock?")) {
      return;
    }
    setUpdatingId(itemId);
    try {
      await axios.delete(`/api/retailer/cart/items/${itemId}/delete/`, {
        withCredentials: true,
      });
      await fetchCart();
      if (onCartUpdated) onCartUpdated();
      refresh(["retailer", "inventory", "quotes"]);
    } catch (err) {
      console.error("Error deleting cart item:", err);
      alert("Failed to remove item from cart.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleClearCart = async () => {
    if (!window.confirm("Clear all items from your cart and release all reserved stock?")) {
      return;
    }
    setLoading(true);
    try {
      await axios.delete("/api/retailer/cart/clear/", { withCredentials: true });
      await fetchCart();
      if (onCartUpdated) onCartUpdated();
      refresh(["retailer", "inventory", "quotes"]);
    } catch (err) {
      console.error("Error clearing retailer cart:", err);
      alert("Failed to clear cart.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrderSubmit = async (e) => {
    e.preventDefault();
    setCreatingOrder(true);
    setOrderError("");

    try {
      const res = await axios.post(
        "/api/retailer/orders/create-from-cart/",
        { notes: orderNotes },
        { withCredentials: true }
      );

      alert(`🎉 Commercial order placed successfully! ${res.data?.orders?.length || 1} order record(s) created with full multi-farmer provenance.`);
      setShowOrderModal(false);
      setOrderNotes("");
      await fetchCart();
      if (onCartUpdated) onCartUpdated();
      if (onOrderCreated) onOrderCreated(res.data?.orders);
      refresh(["retailer", "inventory", "deals", "fpo", "escrow"]);
    } catch (err) {
      console.error("Error creating order from cart:", err.response?.data || err);
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to create order.";
      setOrderError(msg);
    } finally {
      setCreatingOrder(false);
    }
  };

  const items = cartData.items || [];
  const summary = cartData.summary || {};

  return (
    <div className="space-y-6">
      {/* ── Header Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span>🛒</span>
            <span>Retailer Stock Cart — Reserved Quote Allocations</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review reserved FPO market quotes, verify farmer & crop passport provenance, and proceed to order.
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setOrderError("");
                setShowOrderModal(true);
              }}
              className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>📦</span>
              <span><span className="hidden xs:inline">Proceed to </span>Order</span>
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

      {/* ── Summary Stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-purple-50/70 to-indigo-50/50 p-4 rounded-2xl border border-purple-200/80 min-w-0">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block truncate">Total Value</span>
          <span className="text-2xl font-extrabold text-purple-900 font-mono mt-1 block truncate">
            {summary.total_cart_value_eth || "0"} ETH
          </span>
        </div>

        <div className="bg-gradient-to-br from-blue-50/70 to-cyan-50/50 p-4 rounded-2xl border border-blue-200/80 min-w-0">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block truncate">Quote Items</span>
          <span className="text-2xl font-extrabold text-blue-900 font-mono mt-1 block">
            {summary.total_items_count || 0}
          </span>
        </div>

        <div className="bg-gradient-to-br from-emerald-50/70 to-green-50/50 p-4 rounded-2xl border border-emerald-200/80 min-w-0">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block truncate">FPO Partners</span>
          <span className="text-2xl font-extrabold text-emerald-900 font-mono mt-1 block">
            {summary.unique_fpos_count || 0}
          </span>
        </div>

        <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/50 p-4 rounded-2xl border border-amber-200/80 min-w-0">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block truncate">Farmer Sources</span>
          <span className="text-2xl font-extrabold text-amber-900 font-mono mt-1 block">
            {summary.unique_farmers_count || 0}
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
          <p>Loading active cart reservations…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
          <span className="text-4xl block">🛒</span>
          <h3 className="text-sm font-extrabold text-slate-800">Your Retailer Cart is Empty</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Browse open FPO market quotes in the "Wholesale FPO Marketplace" tab and select quantities to reserve stock in your cart.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const quote = item.quote_details || {};
            const fpoName = quote.fpo_name || "FPO Partner";
            const allocations = quote.allocations || [];
            const provSummary = quote.provenance_summary || {};
            const currentInput = quantityInputs[item.id] ?? item.selected_quantity;
            const isModified = String(currentInput) !== String(item.selected_quantity);
            const totalItemEth = item.item_total_price || "0";

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-purple-300 transition-all space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left: Product & FPO Details */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-extrabold text-slate-900 truncate">
                        {quote.product_name || "Commercial Lot"}
                      </span>
                      {quote.category && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          {quote.category}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-slate-400">
                        Quote #{quote.id}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <div className="truncate">
                        <strong className="text-slate-400 font-semibold">FPO Supplier:</strong>{" "}
                        <span className="font-extrabold text-slate-800">{fpoName}</span>{" "}
                        {quote.fpo_location && <span className="text-slate-400">({quote.fpo_location})</span>}
                      </div>
                      <div>
                        <strong className="text-slate-400 font-semibold">Asking Price:</strong>{" "}
                        <span className="font-bold text-blue-700 font-mono">
                          {quote.price_per_unit} ETH / {quote.unit}
                        </span>
                      </div>
                    </div>

                    {/* Provenance Allocations Box */}
                    <ProvenanceCard
                      allocations={allocations}
                      provenanceSummary={provSummary}
                      fpoName={fpoName}
                    />

                    {/* Metrics Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100 text-xs">
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Selected Qty</span>
                        <span className="font-extrabold text-purple-700 font-mono mt-0.5 block truncate">
                          {item.selected_quantity} {quote.unit}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Remaining Stock</span>
                        <span className="font-semibold text-emerald-700 font-mono mt-0.5 block truncate">
                          {item.available_remaining_quantity} {quote.unit}
                        </span>
                      </div>
                      <div className="col-span-2 sm:col-span-1 min-w-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Total Price</span>
                        <span className="font-extrabold text-slate-900 font-mono mt-0.5 block truncate">
                          {totalItemEth} ETH
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quantity Selector & Controls */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full sm:w-auto pt-2 md:pt-0">
                    <div className="w-full sm:w-36">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Selected Qty ({quote.unit})
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          min="0.000001"
                          max={parseFloat(item.available_remaining_quantity) + parseFloat(item.selected_quantity)}
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

      {/* ── Commercial Order Modal ────────────────────────────────────── */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleCreateOrderSubmit}
            className="bg-white rounded-3xl max-w-xl w-full p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl border border-slate-200 animate-fade-in max-h-[92vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📦</span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Confirm Commercial Order
                  </h3>
                  <p className="text-xs text-slate-500">
                    Establishes commercial order records for your {summary.total_items_count} reserved quote item(s).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {orderError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                ⚠️ {orderError}
              </div>
            )}

            {/* Order Summary Box */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900">Total Order Value:</span>
                <span className="font-extrabold text-emerald-950 font-mono text-sm">
                  {summary.total_cart_value_eth} ETH
                </span>
              </div>

              <div className="border-t border-emerald-200/60 pt-2 space-y-1 text-slate-700">
                <div className="font-semibold text-emerald-950 text-[11px]">Items Breakdown:</div>
                {items.map((item, idx) => {
                  const q = item.quote_details || {};
                  return (
                    <div key={item.id} className="flex justify-between items-center text-[11px]">
                      <span>
                        #{idx + 1}. {q.product_name} ({q.fpo_name})
                      </span>
                      <span className="font-mono font-bold text-emerald-900">
                        {item.selected_quantity} {q.unit} @ {q.price_per_unit} ETH
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-slate-700">Delivery & Logistics Notes (Optional)</label>
              <textarea
                rows="3"
                placeholder="Preferred warehouse delivery location, unloading schedule, contact phone…"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-purple-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingOrder}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>📦</span>
                <span>{creatingOrder ? "Placing Order…" : "Place Order Now"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
