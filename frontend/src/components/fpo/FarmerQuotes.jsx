import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import { calculateTotalEth } from "../../utils/pricing";
import MarketplaceFilterBar from "../common/MarketplaceFilterBar";
import BaseModal from "../common/BaseModal";
import StatusBadge from "../common/StatusBadge";
import AddressCopy from "../common/AddressCopy";

export default function FarmerQuotes({ onBidPlaced }) {
  const { refresh } = useRefresh();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentFilters, setCurrentFilters] = useState({});

  // Active Modals state
  const [detailsModalQuote, setDetailsModalQuote] = useState(null);
  const [bidModalQuote, setBidModalQuote] = useState(null);

  // Bidding inputs
  const [bidAmount, setBidAmount] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("2");
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [bidStatusMsg, setBidStatusMsg] = useState(null);

  const filterRef = useRef({});

  const fetchQuotes = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const cleanParams = {};
      Object.keys(params).forEach((k) => {
        if (params[k]) cleanParams[k] = params[k];
      });

      const res = await axios.get("/api/fpo/quotes/farmer/open/", {
        params: cleanParams,
        withCredentials: true,
      });
      setQuotes(res.data || []);
    } catch (err) {
      console.error("Error fetching farmer quotes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFilterChange = useCallback((newFilters) => {
    filterRef.current = newFilters;
    setCurrentFilters(newFilters);
    fetchQuotes(newFilters);
  }, [fetchQuotes]);

  useEffect(() => {
    fetchQuotes({});
  }, [fetchQuotes]);

  useRefreshSubscription(["quotes", "farmer", "deals"], () => fetchQuotes(filterRef.current));

  const openBidModal = (quote) => {
    setBidModalQuote(quote);
    setBidAmount(quote.price_per_unit || "");
    setDeliveryDays("2");
    setBidStatusMsg(null);
  };

  const handleBidSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!bidModalQuote) return;

    if (!bidAmount || Number(bidAmount) <= 0) {
      alert("⚠️ Please enter a valid positive bid amount in ETH.");
      return;
    }

    const days = Number(deliveryDays) || 2;
    if (days <= 0) {
      alert("⚠️ Delivery window must be at least 1 day.");
      return;
    }

    setIsSubmittingBid(true);
    setBidStatusMsg(null);

    try {
      await axios.post(
        `/api/fpo/quotes/farmer/${bidModalQuote.id}/bids/`,
        {
          bid_amount: bidAmount,
          delivery_time_days: days,
        },
        { withCredentials: true }
      );
      setBidStatusMsg({
        type: "success",
        text: "✅ Procurement bid placed successfully! The farmer will review your offer.",
      });
      fetchQuotes(filterRef.current);
      if (onBidPlaced) onBidPlaced();
      refresh(["quotes", "bids", "farmer", "fpo"]);
      setTimeout(() => {
        setBidModalQuote(null);
      }, 1200);
    } catch (err) {
      console.error("Error placing bid:", err.response?.data || err.message);
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Failed to place bid. Please try again.";
      setBidStatusMsg({ type: "error", text: `❌ ${msg}` });
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const hasActiveFilters = Object.values(currentFilters).some((v) => !!v);

  return (
    <div className="space-y-4">
      {/* ── Search & Filter Bar ─────────────────────────────────────── */}
      <MarketplaceFilterBar
        onFilterChange={handleFilterChange}
        showHarvestDate={true}
        placeholder="Filter harvest lots by crop name, category, or farmer…"
      />

      {/* ── Procurement Lots Listing ────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 animate-pulse space-y-2.5">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-3 bg-slate-200 rounded w-2/3"></div>
              <div className="h-8 bg-slate-200 rounded mt-2"></div>
            </div>
          ))}
        </div>
      ) : quotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {quotes.map((quote) => {
            const cp = quote.crop_passport_details;
            const aiGrade = cp?.latest_ai_verification?.quality_grade || cp?.ai_grade;
            const farmerName = quote.farmer_name || (cp ? "Verified Producer" : "Local Farmer");

            return (
              <div
                key={quote.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-4.5 hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between gap-3 min-w-0"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {/* Crop Image or Icon Fallback */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0 relative flex items-center justify-center">
                    {cp?.primary_image_url ? (
                      <img
                        src={cp.primary_image_url}
                        alt={quote.product_name}
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

                  {/* Core Procurement Info */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
                        {quote.product_name}
                      </h4>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        {quote.category}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 font-medium truncate">
                      👨‍🌾 Farmer: <strong className="text-slate-800">{farmerName}</strong>
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                      <span className="font-extrabold text-slate-900 font-mono">
                        {quote.quantity} {quote.unit}
                      </span>
                      {quote.price_per_unit && (
                        <span className="text-blue-700 font-mono font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {quote.price_per_unit} ETH/{quote.unit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Badges & Primary Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {cp?.is_minted ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                        💎 NFT Verified
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium truncate">
                        Deadline: {quote.deadline}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDetailsModalQuote(quote)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <span>🔍</span>
                      <span>Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openBidModal(quote)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span>🤝</span>
                      <span>Make Offer</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : hasActiveFilters ? (
        <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-200/80 space-y-2">
          <span className="text-4xl block">🔍</span>
          <p className="text-sm font-bold text-slate-800">No Supply Quotes Found</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No crop supply quotes matched your current filter criteria.
          </p>
        </div>
      ) : (
        <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
          <span className="text-4xl block mb-2">🌾</span>
          <p className="text-sm font-bold text-slate-800">No Open Farmer Quotes Available</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Farmers have not published any new open harvest lots for procurement at this time.
          </p>
        </div>
      )}

      {/* ── Procurement Crop Details Modal ──────────────────────────── */}
      {detailsModalQuote && (
        <BaseModal
          isOpen={Boolean(detailsModalQuote)}
          onClose={() => setDetailsModalQuote(null)}
          title={detailsModalQuote.product_name}
          subtitle={`Farmer Supply Lot #${detailsModalQuote.id} · ${detailsModalQuote.category}`}
          icon="🌾"
          badge={<StatusBadge status={detailsModalQuote.status} />}
          maxWidth="max-w-xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setDetailsModalQuote(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = detailsModalQuote;
                  setDetailsModalQuote(null);
                  openBidModal(q);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <span>🤝</span>
                <span>Make Procurement Offer</span>
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Image Preview if available */}
            {detailsModalQuote.crop_passport_details?.primary_image_url && (
              <img
                src={detailsModalQuote.crop_passport_details.primary_image_url}
                alt={detailsModalQuote.product_name}
                className="w-full h-44 object-cover rounded-2xl border border-slate-200 shadow-xs"
              />
            )}

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Lot Quantity</span>
                <span className="font-extrabold font-mono text-slate-900 block mt-0.5 truncate">
                  {detailsModalQuote.quantity} {detailsModalQuote.unit}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Asking Price</span>
                <span className="font-extrabold font-mono text-blue-700 block mt-0.5 truncate">
                  {detailsModalQuote.price_per_unit ? `${detailsModalQuote.price_per_unit} ETH / ${detailsModalQuote.unit}` : "Open for bids"}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Deadline</span>
                <span className="font-medium text-slate-700 block mt-0.5 truncate">
                  {detailsModalQuote.deadline || "N/A"}
                </span>
              </div>
            </div>

            {/* Farmer & Location Info */}
            <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Source Farmer:</span>
                <span className="font-extrabold text-slate-900">
                  {detailsModalQuote.farmer_name || "Verified Agricultural Producer"}
                </span>
              </div>
              {detailsModalQuote.crop_passport_details?.location && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Farm Location:</span>
                  <span className="font-semibold text-slate-800">
                    📍 {detailsModalQuote.crop_passport_details.location}
                  </span>
                </div>
              )}
              {detailsModalQuote.crop_passport_details?.harvest_date && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Harvest Date:</span>
                  <span className="font-medium text-slate-700">
                    {detailsModalQuote.crop_passport_details.harvest_date}
                  </span>
                </div>
              )}
            </div>

            {/* AI Verification Assessment */}
            {detailsModalQuote.crop_passport_details?.latest_ai_verification && (
              <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  🤖 Gemini AI Crop Assessment
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-emerald-900 text-sm">
                    Grade {detailsModalQuote.crop_passport_details.latest_ai_verification.quality_grade}
                  </span>
                  <span className="font-mono text-emerald-700">
                    Score: {detailsModalQuote.crop_passport_details.latest_ai_verification.quality_score}/100
                  </span>
                </div>
              </div>
            )}

            {detailsModalQuote.description && (
              <p className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                "{detailsModalQuote.description}"
              </p>
            )}
          </div>
        </BaseModal>
      )}

      {/* ── Make Procurement Offer Modal ─────────────────────────────── */}
      {bidModalQuote && (
        <BaseModal
          isOpen={Boolean(bidModalQuote)}
          onClose={() => setBidModalQuote(null)}
          title={`Make Procurement Offer: ${bidModalQuote.product_name}`}
          subtitle={`Lot #${bidModalQuote.id} · ${bidModalQuote.quantity} ${bidModalQuote.unit}`}
          icon="🤝"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleBidSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Crop Lot:</span>
                <span className="font-bold text-slate-900">{bidModalQuote.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lot Quantity:</span>
                <span className="font-bold text-slate-900">{bidModalQuote.quantity} {bidModalQuote.unit}</span>
              </div>
              {bidModalQuote.price_per_unit && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Farmer Asking Rate:</span>
                  <span className="font-mono text-blue-700 font-bold">{bidModalQuote.price_per_unit} ETH / {bidModalQuote.unit}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Your Procurement Offer (ETH / {bidModalQuote.unit}) *
              </label>
              <input
                type="number"
                step="any"
                min="0.000001"
                required
                placeholder="e.g. 0.005"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Required Delivery Window (Days) *
              </label>
              <input
                type="number"
                min="1"
                required
                placeholder="2"
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Computed Total Lot Procurement Value */}
            {bidAmount && Number(bidAmount) > 0 && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
                <span className="text-blue-900 font-semibold">Total Escrow Value:</span>
                <span className="font-extrabold text-blue-950 font-mono text-sm">
                  {calculateTotalEth(bidAmount, bidModalQuote.quantity)} ETH
                </span>
              </div>
            )}

            {bidStatusMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                bidStatusMsg.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}>
                {bidStatusMsg.text}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBidModalQuote(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingBid || !bidAmount || Number(bidAmount) <= 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span>🤝</span>
                <span>{isSubmittingBid ? "Submitting…" : "Send Procurement Bid"}</span>
              </button>
            </div>
          </form>
        </BaseModal>
      )}
    </div>
  );
}
