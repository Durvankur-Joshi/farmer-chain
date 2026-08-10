import React, { useState } from "react";
import axios from "axios";

export default function BidForm({ quote, onClose, onSuccess }) {
  const [bidAmount, setBidAmount] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitBid = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await axios.post(
        `/api/fpo/quotes/farmer/${quote.id}/bids/`,
        { bid_amount: bidAmount, delivery_time_days: deliveryDays },
        { withCredentials: true }
      );
      onSuccess && onSuccess();
      onClose && onClose();
    } catch (err) {
      console.error("Error submitting bid:", err);
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to submit bid. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-blue-200 p-5 rounded-2xl shadow-xs bg-blue-50/40 space-y-3.5 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
          Place Procurement Bid on {quote.product_name}
        </h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
          Lot: {quote.quantity} {quote.unit}
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={submitBid} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Bid Price (ETH / {quote.unit}) *
            </label>
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              placeholder="e.g. 0.002"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-blue-500 outline-none font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Delivery Window (Days) *
            </label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 3"
              value={deliveryDays}
              onChange={(e) => setDeliveryDays(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-blue-500 outline-none"
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Submitting Bid…" : "Submit Procurement Bid"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
