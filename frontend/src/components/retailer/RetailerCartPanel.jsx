import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import ProvenanceCard from "../common/ProvenanceCard";
import BaseModal from "../common/BaseModal";

export default function RetailerCartPanel({ onCartUpdated, onOrderCreated }) {
  const { refresh } = useRefresh();
  const [cartData, setCartData] = useState({ items: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [quantityInputs, setQuantityInputs] = useState({});

  // Provenance modal state for cart items
  const [provenanceModalItem, setProvenanceModalItem] = useState(null);

  // Deal creation modal
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

      alert(`🎉 Commercial deal confirmed! ${res.data?.orders?.length || 1} order record(s) created with full multi-farmer provenance.`);
      setShowOrderModal(false);
      setOrderNotes("");
      await fetchCart();
      if (onCartUpdated) onCartUpdated();
      if (onOrderCreated) onOrderCreated(res.data?.orders);
      refresh(["retailer", "inventory", "deals", "fpo", "escrow"]);
    } catch (err) {
      console.error("Error creating order from cart:", err.response?.data || err);
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to create deal.";
      setOrderError(msg);
    } finally {
      setCreatingOrder(false);
    }
  };

  const items = useMemo(() => cartData.items || [], [cartData.items]);
  const summary = cartData.summary || {};

  const totalSelectedVolume = useMemo(() => {
    return items.reduce((acc, it) => acc + (parseFloat(it.selected_quantity) || 0), 0);
  }, [items]);

  return (
    <div className="space-y-5">
      {/* ── Surface Header Bar ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛒</span>
            <h2 className="text-base font-extrabold text-slate-900">
              Retailer Stock Cart
            </h2>
            <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              Temporary Checkout State
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-xl">
            Reserved FPO market quotes held for checkout. This is a temporary cart state, NOT permanent purchased inventory.
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleClearCart}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-rose-200 flex items-center gap-1"
            >
              <span>🗑️</span>
              <span>Clear Cart</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOrderError("");
                setShowOrderModal(true);
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>🤝</span>
              <span>Proceed to Deal</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Summary Stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs min-w-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Total Cart Value</span>
          <span className="text-xl sm:text-2xl font-extrabold text-purple-900 font-mono mt-1 block truncate">
            {summary.total_cart_value_eth || "0"} ETH
          </span>
          <span className="text-[11px] text-purple-600 font-semibold mt-0.5 block">Estimated Total</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs min-w-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Reserved Lots</span>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
            {summary.total_items_count || 0}
          </span>
          <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">In Current Cart</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs min-w-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">FPO Suppliers</span>
          <span className="text-xl sm:text-2xl font-extrabold text-blue-900 font-mono mt-1 block">
            {summary.unique_fpos_count || 0}
          </span>
          <span className="text-[11px] text-blue-600 font-semibold mt-0.5 block">Partner Organizations</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs min-w-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Source Farmers</span>
          <span className="text-xl sm:text-2xl font-extrabold text-emerald-900 font-mono mt-1 block">
            {summary.unique_farmers_count || 0}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">Traceable Producers</span>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* ── Cart Items List ─────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 animate-pulse space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-8 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-2">
          <span className="text-4xl block">🛒</span>
          <h3 className="text-sm font-extrabold text-slate-800">Your Retailer Cart is Empty</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Browse open FPO market quotes in the "Market" tab and select quantities to reserve stock in your cart.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const quote = item.quote_details || {};
            const fpoName = quote.fpo_name || "FPO Partner";
            const currentInput = quantityInputs[item.id] ?? item.selected_quantity;
            const isModified = String(currentInput) !== String(item.selected_quantity);
            const totalItemEth = item.item_total_price || "0";
            const allocations = quote.allocations || [];

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-purple-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0"
              >
                {/* Left: Product, Supplier, Price Details */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-extrabold text-slate-900 truncate">
                      {quote.product_name || "Commercial Lot"}
                    </span>
                    {quote.category && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                        {quote.category}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-400">
                      Quote #{quote.id}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <div className="truncate">
                      <span className="text-slate-400">FPO Supplier:</span>{" "}
                      <strong className="text-slate-800 font-semibold">{fpoName}</strong>
                      {quote.fpo_location && <span className="text-slate-400 font-normal"> ({quote.fpo_location})</span>}
                    </div>
                    <div>
                      <span className="text-slate-400">Unit Price:</span>{" "}
                      <strong className="font-mono text-blue-700">{quote.price_per_unit} ETH / {quote.unit}</strong>
                    </div>
                  </div>

                  {/* Compact Provenance Trigger */}
                  {allocations.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setProvenanceModalItem(item)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 transition-all cursor-pointer"
                    >
                      <span>🌿</span>
                      <span>Verified Lineage: {allocations.length} source farmer{allocations.length > 1 ? "s" : ""}</span>
                      <span className="text-purple-400">➔</span>
                    </button>
                  )}
                </div>

                {/* Center: Total Price Box */}
                <div className="bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100 text-center shrink-0 min-w-28">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Price</span>
                  <span className="text-base font-extrabold font-mono text-emerald-700 block mt-0.5">
                    {totalItemEth} ETH
                  </span>
                </div>

                {/* Right: Quantity Input & Remove Action */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <div className="w-28">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Qty ({quote.unit})
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        min="0.000001"
                        max={parseFloat(item.available_remaining_quantity) + parseFloat(item.selected_quantity)}
                        value={currentInput}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-purple-500 outline-none"
                      />
                      {isModified && (
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.id)}
                          disabled={updatingId === item.id}
                          className="px-2 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0"
                          title="Save new quantity"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={updatingId === item.id}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-all cursor-pointer self-end mt-auto"
                    title="Remove quote from cart"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}

          {/* Bottom Summary Bar with Proceed to Deal Action */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 block font-sans text-[10px] font-bold uppercase">Total Volume:</span>
                <span className="font-extrabold text-slate-900 text-sm">{totalSelectedVolume.toFixed(2)} units</span>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block font-sans text-[10px] font-bold uppercase">Total Cart Price:</span>
                <span className="font-extrabold text-emerald-700 text-sm sm:text-base">{summary.total_cart_value_eth} ETH</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOrderError("");
                setShowOrderModal(true);
              }}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🤝</span>
              <span>Proceed to Deal</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Cart Item Lineage Modal ─────────────────────────────────── */}
      {provenanceModalItem && (
        <BaseModal
          isOpen={Boolean(provenanceModalItem)}
          onClose={() => setProvenanceModalItem(null)}
          title={`Traceability: ${provenanceModalItem.quote_details?.product_name || "Reserved Lot"}`}
          subtitle={`FPO Supplier: ${provenanceModalItem.quote_details?.fpo_name} · Quote #${provenanceModalItem.quote_details?.id}`}
          icon="🌿"
          maxWidth="max-w-xl"
          footer={
            <div className="flex justify-end w-full">
              <button
                type="button"
                onClick={() => setProvenanceModalItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <ProvenanceCard
              allocations={provenanceModalItem.quote_details?.allocations || []}
              provenanceSummary={provenanceModalItem.quote_details?.provenance_summary || {}}
              fpoName={provenanceModalItem.quote_details?.fpo_name}
            />
          </div>
        </BaseModal>
      )}

      {/* ── Confirm Commercial Deal Modal ───────────────────────────── */}
      {showOrderModal && (
        <BaseModal
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          title="Confirm Commercial Deal"
          subtitle={`Establish official commercial procurement deals for your ${summary.total_items_count} reserved quote lot(s).`}
          icon="🤝"
          maxWidth="max-w-xl"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateOrderSubmit}
                disabled={creatingOrder}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>🤝</span>
                <span>{creatingOrder ? "Processing Deal…" : "Confirm Deal Now"}</span>
              </button>
            </div>
          }
        >
          <form onSubmit={handleCreateOrderSubmit} className="space-y-4 text-xs">
            {orderError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                ⚠️ {orderError}
              </div>
            )}

            {/* Deal Summary Box */}
            <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-900">Total Deal Value:</span>
                <span className="font-extrabold text-purple-950 font-mono text-sm sm:text-base">
                  {summary.total_cart_value_eth} ETH
                </span>
              </div>

              <div className="border-t border-purple-200/60 pt-2 space-y-1.5 text-slate-700">
                <div className="font-semibold text-purple-950 text-[11px]">Included Wholesale Lots:</div>
                {items.map((item, idx) => {
                  const q = item.quote_details || {};
                  return (
                    <div key={item.id} className="flex justify-between items-center text-[11px] bg-white/70 p-2 rounded-xl border border-purple-100">
                      <div className="truncate pr-2">
                        <span className="font-semibold text-slate-900">#{idx + 1}. {q.product_name}</span>{" "}
                        <span className="text-slate-400">({q.fpo_name})</span>
                      </div>
                      <span className="font-mono font-bold text-purple-900 shrink-0">
                        {item.selected_quantity} {q.unit} · {item.item_total_price} ETH
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700">Delivery & Logistics Instructions (Optional)</label>
              <textarea
                rows="3"
                placeholder="Preferred warehouse delivery location, dock hours, receiving contact…"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-purple-500 outline-none"
              />
            </div>
          </form>
        </BaseModal>
      )}
    </div>
  );
}
