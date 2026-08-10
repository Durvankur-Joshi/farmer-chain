import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

export default function FarmerQuotes() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState({});
  const [deliveryDays, setDeliveryDays] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [statusMsgMap, setStatusMsgMap] = useState({});

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/fpo/quotes/farmer/open/", { withCredentials: true });
      setQuotes(res.data || []);
    } catch (err) {
      console.error("Error fetching farmer quotes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const handleBidSubmit = async (quoteId) => {
    const amount = bidAmount[quoteId];
    if (!amount || Number(amount) <= 0) {
      alert("⚠️ Please enter a valid bid amount in ETH.");
      return;
    }

    const days = deliveryDays[quoteId] || 2;

    setLoadingMap((prev) => ({ ...prev, [quoteId]: true }));
    setStatusMsgMap((prev) => ({ ...prev, [quoteId]: null }));

    try {
      await axios.post(
        `/api/fpo/quotes/farmer/${quoteId}/bids/`,
        {
          bid_amount: amount,
          delivery_time_days: days,
        },
        { withCredentials: true }
      );
      setStatusMsgMap((prev) => ({ ...prev, [quoteId]: { type: "success", text: "✅ Bid placed successfully! Farmer will review your offer." } }));
      setBidAmount((prev) => ({ ...prev, [quoteId]: "" }));
      fetchQuotes();
    } catch (err) {
      console.error("Error placing bid:", err.response?.data || err.message);
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to place bid. Please try again.";
      setStatusMsgMap((prev) => ({ ...prev, [quoteId]: { type: "error", text: `❌ ${msg}` } }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [quoteId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 animate-pulse space-y-2">
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-3 bg-slate-200 rounded w-2/3"></div>
            <div className="h-8 bg-slate-200 rounded w-1/4 mt-2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
        <span className="text-4xl block mb-2">🌾</span>
        <p className="text-sm font-bold text-slate-800">No Open Farmer Quotes Available</p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Farmers have not published any new open harvest lots for procurement at this time. Please check back shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {quotes.map((quote) => {
        const currentBid = bidAmount[quote.id] || "";
        const totalEst = currentBid && quote.quantity ? (parseFloat(currentBid) * parseFloat(quote.quantity)).toFixed(4) : null;
        const statusMsg = statusMsgMap[quote.id];

        return (
          <div
            key={quote.id}
            className="border border-slate-200/80 rounded-2xl p-5 hover:border-blue-300 hover:shadow-xs transition-all bg-white space-y-3"
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-extrabold text-slate-900">
                    {quote.product_name}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                    {quote.category}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Quote #{quote.id}
                  </span>
                </div>

                {quote.description && (
                  <p className="text-xs text-slate-600">
                    {quote.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                  <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 font-medium">
                    <strong className="text-slate-700">Lot Quantity:</strong> {quote.quantity} {quote.unit}
                  </span>
                  <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 font-medium">
                    <strong className="text-slate-700">Deadline:</strong> {quote.deadline}
                  </span>
                  {quote.price_per_unit && (
                    <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 font-medium">
                      <strong className="text-slate-700">Farmer Target:</strong> ₹{quote.price_per_unit} / {quote.unit}
                    </span>
                  )}
                </div>
              </div>

              {/* Bidding Controls */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 lg:pt-0 shrink-0">
                <div className="relative w-36">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Offer (ETH/{quote.unit})
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.002"
                    value={bidAmount[quote.id] || ""}
                    onChange={(e) =>
                      setBidAmount({ ...bidAmount, [quote.id]: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono font-bold"
                  />
                </div>

                <div className="relative w-28">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Delivery (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="2"
                    value={deliveryDays[quote.id] || ""}
                    onChange={(e) =>
                      setDeliveryDays({ ...deliveryDays, [quote.id]: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold"
                  />
                </div>

                <div className="self-end">
                  <button
                    type="button"
                    onClick={() => handleBidSubmit(quote.id)}
                    disabled={loadingMap[quote.id]}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 h-[38px]"
                  >
                    <span>💰</span>
                    <span>{loadingMap[quote.id] ? "Submitting…" : "Place Bid"}</span>
                  </button>
                </div>
              </div>
            </div>

            {totalEst && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Calculated Total Procurement Value:</span>
                <span className="font-extrabold text-blue-700 font-mono text-sm">{totalEst} ETH</span>
              </div>
            )}

            {statusMsg && (
              <div className={`p-2.5 rounded-xl text-xs font-medium ${
                statusMsg.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}>
                {statusMsg.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
