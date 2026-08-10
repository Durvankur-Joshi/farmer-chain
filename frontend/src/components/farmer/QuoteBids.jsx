import React, { useState } from "react";
import axios from "axios";
import StatusBadge from "../common/StatusBadge";

export default function QuoteBids({ quote, onBack, refreshHistory }) {
  const [acceptingId, setAcceptingId] = useState(null);

  const acceptBid = async (bidId) => {
    setAcceptingId(bidId);
    try {
      await axios.post(
        `/api/farmer/bids/fpo/${bidId}/accept/`,
        {},
        { withCredentials: true }
      );
      alert("✅ Bid accepted successfully! You can now create an Escrow payment.");
      if (refreshHistory) refreshHistory();
    } catch (err) {
      console.error("Error accepting bid:", err);
      alert("❌ Failed to accept bid. Please try again.");
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
        <div>
          <button
            onClick={onBack}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1 flex items-center gap-1 cursor-pointer"
          >
            ← Back to Quotes
          </button>
          <h3 className="text-base font-extrabold text-slate-900">
            📦 Bids for {quote.product_name} <span className="text-xs text-slate-500 font-normal">({quote.category})</span>
          </h3>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
          Lot Qty: {quote.quantity} {quote.unit}
        </span>
      </div>

      {quote.bids && quote.bids.length > 0 ? (
        <div className="space-y-3">
          {quote.bids.map((bid, index) => {
            const totalValue = (parseFloat(bid.bid_amount) * parseFloat(quote.quantity)).toFixed(4);
            const isAccepted = bid.status === "accepted";
            const isProcessing = acceptingId === bid.id;

            return (
              <div
                key={bid.id || index}
                className={`border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all ${
                  isAccepted
                    ? "bg-emerald-50/40 border-emerald-300 shadow-2xs"
                    : "bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs"
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-extrabold text-slate-900 font-mono">
                      {bid.bid_amount} ETH <span className="text-xs text-slate-400 font-normal font-sans">/ {quote.unit}</span>
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                      Total: {totalValue} ETH
                    </span>
                    <StatusBadge status={bid.status} />
                  </div>

                  <p className="text-xs text-slate-700 font-semibold">
                    🏢 FPO Buyer: <span className="font-bold text-slate-900">{bid.fpo_name || `FPO #${bid.fpo}`}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                    <span>⏳ Delivery Window: <strong>{bid.delivery_time_days} days</strong></span>
                    <span>Submitted: {new Date(bid.submitted_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Accept button */}
                <div className="pt-2 sm:pt-0 shrink-0">
                  <button
                    type="button"
                    onClick={() => acceptBid(bid.id)}
                    disabled={isAccepted || isProcessing}
                    className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                      isAccepted
                        ? "bg-emerald-100 text-emerald-800 cursor-not-allowed border border-emerald-300"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 disabled:opacity-50"
                    }`}
                  >
                    <span>{isAccepted ? "✓" : "🤝"}</span>
                    <span>{isProcessing ? "Accepting…" : isAccepted ? "Bid Accepted" : "Accept FPO Bid"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
          <span className="text-4xl block mb-2">⏳</span>
          <p className="text-sm font-bold text-slate-800">No Bids Received Yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            FPO organizations are reviewing this supply quote. Submitted bids will be listed here with payment details.
          </p>
        </div>
      )}
    </div>
  );
}
