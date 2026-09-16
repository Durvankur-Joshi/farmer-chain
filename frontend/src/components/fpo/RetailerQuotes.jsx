import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import { formatInr, formatCommercialPrice } from "../../utils/pricing";
import NegotiationModal from "../common/NegotiationModal";
import ProvenanceCard from "../common/ProvenanceCard";
import BaseModal from "../common/BaseModal";
import StatusBadge from "../common/StatusBadge";

export default function RetailerQuotes({
  onNavigateToCart,
  onNavigateToEscrow,
  onBidAccepted,
  onQuoteCreated,
}) {
  const { refresh } = useRefresh();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedQuote, setExpandedQuote] = useState(null);
  const [negotiatingBid, setNegotiatingBid] = useState(null);
  const [acceptingBidId, setAcceptingBidId] = useState(null);

  // Create Wholesale Offer Modal State
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [cartSummary, setCartSummary] = useState(null);
  const [offerForm, setOfferForm] = useState({
    product_name: "",
    price_per_unit: "",
    quantity_to_sell: "",
    deadline: "",
    description: "",
  });
  const [publishing, setPublishing] = useState(false);
  const [offerError, setOfferError] = useState("");

  const fetchRetailerQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/fpo/quotes/", {
        withCredentials: true,
      });
      setQuotes(res.data || []);
    } catch (err) {
      console.error("Error fetching retailer quotes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCartSummary = useCallback(async () => {
    try {
      const res = await axios.get("/api/fpo/cart/", { withCredentials: true });
      setCartSummary(res.data);
      if (res.data?.items?.length > 0) {
        const first = res.data.items[0];
        setOfferForm((prev) => ({
          ...prev,
          product_name: prev.product_name || first.inventory_lot_details?.product_name || "",
          quantity_to_sell: prev.quantity_to_sell || String(res.data.summary?.total_selected_quantity || ""),
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  const acceptBid = async (bidId, quoteId) => {
    setAcceptingBidId(bidId);
    try {
      const res = await axios.post(
        `/api/fpo/bids/retailer/${bidId}/accept/`,
        {},
        { withCredentials: true }
      );

      // Immediate state update so UI updates instantaneously without reload
      const acceptedData = res.data;
      setQuotes((prev) =>
        prev.map((q) => {
          if (q.id === quoteId || q.id === acceptedData.quote_id) {
            return {
              ...q,
              status: acceptedData.quote_status || "awarded",
              accepted_bid: bidId,
              price_per_unit: acceptedData.unit_price_inr || q.price_per_unit,
              escrow_details: acceptedData.escrow || q.escrow_details,
              bids: (q.bids || []).map((b) =>
                b.id === bidId
                  ? { ...b, status: "accepted" }
                  : { ...b, status: "rejected" }
              ),
            };
          }
          return q;
        })
      );

      alert(
        `✅ Retailer offer accepted successfully!\nCommercial deal agreed at ${formatInr(acceptedData.total_amount_inr || 0, true)}.\nEscrow agreement ready for blockchain security.`
      );

      await fetchRetailerQuotes();
      if (onBidAccepted) onBidAccepted();
      refresh(["quotes", "bids", "deals", "fpo", "retailer", "escrow"]);
    } catch (err) {
      console.error("Error accepting bid:", err);
      const msg = err.response?.data?.error || "Failed to accept offer. Please try again.";
      alert(`❌ ${msg}`);
    } finally {
      setAcceptingBidId(null);
    }
  };

  const handleCreateOfferSubmit = async (e) => {
    e.preventDefault();
    setOfferError("");

    if (!cartSummary || cartSummary.items?.length === 0) {
      setOfferError("Your Stock Cart is empty. Please reserve inventory lots before publishing a wholesale offer.");
      return;
    }

    const price = parseFloat(offerForm.price_per_unit);
    if (isNaN(price) || price <= 0) {
      setOfferError("Please enter a valid positive price per unit in ₹ (INR).");
      return;
    }

    if (!offerForm.deadline) {
      setOfferError("Please select a bidding deadline.");
      return;
    }

    setPublishing(true);
    try {
      await axios.post(
        "/api/fpo/quotes/from-cart/",
        {
          product_name: offerForm.product_name,
          price_per_unit: offerForm.price_per_unit,
          deadline: offerForm.deadline,
          description: offerForm.description,
        },
        { withCredentials: true }
      );

      alert("🎉 Wholesale market offer published successfully to registered retailers!");
      setShowOfferModal(false);
      setOfferForm({
        product_name: "",
        price_per_unit: "",
        quantity_to_sell: "",
        deadline: "",
        description: "",
      });
      await fetchRetailerQuotes();
      await fetchCartSummary();
      if (onQuoteCreated) onQuoteCreated();
      refresh(["quotes", "inventory", "fpo", "retailer"]);
    } catch (err) {
      console.error("Error publishing wholesale offer:", err.response?.data || err);
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to publish wholesale offer.";
      setOfferError(msg);
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    fetchRetailerQuotes();
    fetchCartSummary();
  }, [fetchRetailerQuotes, fetchCartSummary]);

  useRefreshSubscription(["quotes", "bids", "deals", "fpo", "retailer", "escrow"], () => {
    fetchRetailerQuotes();
    fetchCartSummary();
  });

  const cartItemsCount = cartSummary?.summary?.total_items_count || 0;
  const availableCartQty = cartSummary?.summary?.total_selected_quantity || 0;
  const totalVolumeToSell = parseFloat(offerForm.quantity_to_sell) || availableCartQty;
  const unitPriceInput = parseFloat(offerForm.price_per_unit) || 0;
  const calculatedTotalInr = totalVolumeToSell * unitPriceInput;

  // Split quotes into Accepted Deals vs Open/Available Quotes
  const acceptedDeals = quotes.filter(
    (q) => q.status === "awarded" || q.status === "closed" || !!q.accepted_bid
  );
  const openQuotes = quotes.filter(
    (q) => q.status !== "awarded" && q.status !== "closed" && !q.accepted_bid
  );

  return (
    <div className="space-y-6">
      {/* ── Wholesale Market Header & Create Offer Action ──────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <span>🛒</span>
            <span>Wholesale Market Offers (Sell to Retailers)</span>
          </h3>
          <p className="text-xs text-slate-500">
            Create wholesale offers from your aggregated inventory and review incoming retailer bids denominated in ₹ (INR).
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              fetchCartSummary();
              setShowOfferModal(true);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>➕</span>
            <span>Create Wholesale Offer</span>
          </button>
        </div>
      </div>

      {/* ── SECTION 1: ACCEPTED WHOLESALE DEALS (ACTIVE COMMERCIAL DEALS) ── */}
      {acceptedDeals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
              <span>🤝</span>
              <span>Accepted Wholesale Deals ({acceptedDeals.length})</span>
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Active Retailer Contracts
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {acceptedDeals.map((q) => {
              const acceptedBid =
                q.bids?.find((b) => b.status === "accepted" || b.id === q.accepted_bid) ||
                q.accepted_bid_details;
              const retailerName =
                acceptedBid?.retailer_name ||
                (acceptedBid?.retailer ? `Retailer #${acceptedBid.retailer}` : "Registered Retailer");
              const qtyNum = parseFloat(q.quantity) || 0;
              const unitRate = parseFloat(q.price_per_unit || acceptedBid?.bid_amount) || 0;
              const totalVal = Math.round(qtyNum * unitRate);
              const escrowStatus = q.escrow_details?.status || "created";

              return (
                <div
                  key={q.id}
                  className="bg-emerald-50/40 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-emerald-300 transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Title & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                            {q.product_name}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Deal Accepted ✓
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 truncate">
                          Retail Buyer: <strong className="text-slate-900 font-semibold">{retailerName}</strong>
                        </p>
                      </div>
                      <StatusBadge status={escrowStatus} />
                    </div>

                    {/* Commercial Pricing Grid */}
                    <div className="grid grid-cols-3 gap-2 bg-white/90 p-2.5 rounded-xl border border-emerald-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans truncate">
                          Quantity
                        </span>
                        <span className="font-extrabold text-slate-900 font-mono mt-0.5 block truncate">
                          {q.quantity} {q.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans truncate">
                          Agreed Rate
                        </span>
                        <span className="font-bold text-emerald-800 font-mono mt-0.5 block truncate">
                          {formatInr(unitRate, true)}/{q.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans truncate">
                          Total Value
                        </span>
                        <span className="font-extrabold text-emerald-950 font-mono mt-0.5 block truncate">
                          {formatInr(totalVal)}
                        </span>
                      </div>
                    </div>

                    {acceptedBid?.delivery_time_days && (
                      <p className="text-[11px] text-slate-500">
                        Agreed Delivery Window: <strong>{acceptedBid.delivery_time_days} days</strong>
                      </p>
                    )}
                  </div>

                  {/* Escrow Link / Action */}
                  <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {q.escrow_details?.escrow_id
                        ? `On-Chain Escrow #${q.escrow_details.escrow_id}`
                        : "Escrow Agreement Ready"}
                    </span>

                    {onNavigateToEscrow && (
                      <button
                        type="button"
                        onClick={onNavigateToEscrow}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        <span>🔐</span>
                        <span>Manage Escrow & Delivery →</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 2: OPEN WHOLESALE MARKET OFFERS & INCOMING BIDS ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Published Wholesale Offers ({openQuotes.length})
          </h3>
          {cartItemsCount > 0 && (
            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
              🛒 {cartItemsCount} Lot(s) Reserved in Cart ({availableCartQty} units)
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 animate-pulse space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : openQuotes.length > 0 ? (
          openQuotes.map((q) => {
            const bids = q.bids || [];
            const bidsCount = bids.length;
            const isExpanded = expandedQuote === q.id || bidsCount > 0;

            return (
              <div
                key={q.id}
                className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-white hover:border-blue-300 transition-all space-y-3 shadow-2xs min-w-0"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-extrabold text-slate-900 truncate">{q.product_name}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">{q.category}</span>
                      {bidsCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          {bidsCount} Offer(s) Received
                        </span>
                      )}
                    </div>
                    {q.description && <p className="text-xs text-slate-500 line-clamp-2">{q.description}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedQuote(expandedQuote === q.id ? null : q.id)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    {expandedQuote === q.id ? "Hide Retailer Bids" : `View Bids (${bidsCount})`}
                  </button>
                </div>

                {/* Offer Metrics */}
                <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans truncate">Lot Quantity</span>
                    <span className="font-extrabold text-slate-900 mt-0.5 block truncate">{q.quantity} {q.unit}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans truncate">Asking Rate</span>
                    <span className="font-bold text-blue-700 mt-0.5 block truncate">
                      {formatCommercialPrice(q.price_per_unit, q.unit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans truncate">Deadline</span>
                    <span className="font-semibold text-slate-700 mt-0.5 block font-sans truncate">{q.deadline}</span>
                  </div>
                </div>

                {/* Provenance Card */}
                {q.allocations && q.allocations.length > 0 && (
                  <ProvenanceCard
                    allocations={q.allocations}
                    provenanceSummary={q.provenance_summary}
                    fpoName="FPO Aggregation Center"
                  />
                )}

                {/* Incoming Retailer Offers / Bids */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5 animate-fade-in">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                      <span>Incoming Retailer Offers ({bidsCount})</span>
                      {bidsCount > 0 && <span className="text-slate-400 font-normal">Review and accept commercial offers</span>}
                    </span>

                    {bidsCount > 0 ? (
                      bids.map((bid) => {
                        const isBidAccepted = bid.status === "accepted";
                        const bidRateNum = parseFloat(bid.bid_amount) || 0;
                        const qtyNum = parseFloat(q.quantity) || 0;
                        const totalInr = Math.round(bidRateNum * qtyNum);
                        const retailerDisplayName =
                          bid.retailer_name || (bid.retailer ? `Retailer #${bid.retailer}` : "Registered Retailer");

                        return (
                          <div
                            key={bid.id}
                            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                              isBidAccepted
                                ? "bg-emerald-50/60 border-emerald-300"
                                : "bg-slate-50/80 border-slate-200"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-900 font-mono text-sm">
                                  {formatInr(bidRateNum, true)} / {q.unit}
                                </span>
                                <span className="text-xs text-blue-900 font-bold font-mono bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                  Total: {formatInr(totalInr)}
                                </span>
                                <StatusBadge status={bid.status} />
                              </div>

                              <p className="text-slate-700 font-medium text-[11px]">
                                Retailer: <strong className="text-slate-900">{retailerDisplayName}</strong> · Delivery Window: <strong>{bid.delivery_time_days} days</strong>
                              </p>

                              {bid.comments && (
                                <p className="text-[11px] text-slate-500 italic">
                                  "{bid.comments}"
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setNegotiatingBid({ bid: bid, contentType: "retailer.retailerbid" })}
                                className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold rounded-lg border border-purple-300 text-xs transition-all cursor-pointer"
                              >
                                Chat / Negotiate
                              </button>

                              <button
                                type="button"
                                onClick={() => acceptBid(bid.id, q.id)}
                                disabled={isBidAccepted || acceptingBidId === bid.id}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                                  isBidAccepted
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-not-allowed"
                                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                                }`}
                              >
                                {acceptingBidId === bid.id
                                  ? "Accepting…"
                                  : isBidAccepted
                                  ? "Accepted ✓"
                                  : "Accept Offer"}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-slate-400 text-xs py-2 italic text-center bg-slate-50/50 rounded-xl">
                        No retailer bids received yet for this wholesale offer.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
            <span className="text-4xl block mb-2">🛒</span>
            <p className="text-sm font-bold text-slate-800">No Open Wholesale Offers</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Reserve stock lots from your inventory and click "Create Wholesale Offer" to publish commercial lots to retailers.
            </p>
          </div>
        )}
      </div>

      {/* ── Create Wholesale Offer Modal ────────────────────────────── */}
      {showOfferModal && (
        <BaseModal
          isOpen={showOfferModal}
          onClose={() => setShowOfferModal(false)}
          title="Create Wholesale Offer (Sell to Retailers)"
          subtitle="Publish aggregated multi-farmer lots to registered commercial retailers"
          icon="🏪"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCreateOfferSubmit} className="space-y-4 text-xs">
            {cartItemsCount > 0 ? (
              <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200/80 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Reserved Stock Lots:</span>
                  <span className="font-extrabold text-purple-900">{cartItemsCount} farmer allocation(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Available Wholesale Volume:</span>
                  <span className="font-extrabold font-mono text-purple-900">{availableCartQty} units</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 space-y-2">
                <p className="font-bold">⚠️ No Stock Reserved in Cart</p>
                <p className="text-[11px] text-amber-700">
                  Please visit the <strong>Inventory</strong> tab and click "Reserve Stock" on one or more farmer lots first.
                </p>
                {onNavigateToCart && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowOfferModal(false);
                      onNavigateToCart();
                    }}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs cursor-pointer shadow-2xs"
                  >
                    Go to Stock Inventory & Reserve →
                  </button>
                )}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Wholesale Product Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Premium Basmati Rice (Aggregated)"
                value={offerForm.product_name}
                onChange={(e) => setOfferForm({ ...offerForm, product_name: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-blue-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Quantity to Sell *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  required
                  value={offerForm.quantity_to_sell}
                  onChange={(e) => setOfferForm({ ...offerForm, quantity_to_sell: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Price per unit (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  required
                  placeholder="e.g. 60"
                  value={offerForm.price_per_unit}
                  onChange={(e) => setOfferForm({ ...offerForm, price_per_unit: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Calculated Total in INR: total = quantity * unit price */}
            {parseFloat(offerForm.price_per_unit) > 0 && (
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Calculation:</span>
                  <span className="font-mono text-slate-700 font-semibold">
                    {totalVolumeToSell} × ₹{offerForm.price_per_unit || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-blue-200/60">
                  <span className="text-blue-900 font-bold">Total Lot Value:</span>
                  <span className="font-bold text-blue-950 font-mono text-sm">
                    {formatInr(calculatedTotalInr, true)}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Bidding Deadline *
              </label>
              <input
                type="date"
                required
                value={offerForm.deadline}
                onChange={(e) => setOfferForm({ ...offerForm, deadline: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Description / Quality Specifications
              </label>
              <textarea
                rows="2"
                placeholder="Bulk moisture level, packaging standards, dispatch timeline…"
                value={offerForm.description}
                onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-blue-500 outline-none"
              />
            </div>

            {offerError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                ❌ {offerError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOfferModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={publishing || cartItemsCount === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span>🚀</span>
                <span>{publishing ? "Sending…" : "Send Offer"}</span>
              </button>
            </div>
          </form>
        </BaseModal>
      )}

      {/* ── Negotiation Modal ───────────────────────────────────────── */}
      {negotiatingBid && (
        <NegotiationModal
          bid={negotiatingBid.bid}
          contentType={negotiatingBid.contentType}
          currentUserRole="fpo"
          onClose={() => setNegotiatingBid(null)}
          onNegotiationUpdated={() => {
            fetchRetailerQuotes();
            refresh(["quotes", "bids", "deals", "fpo", "retailer"]);
          }}
        />
      )}
    </div>
  );
}
