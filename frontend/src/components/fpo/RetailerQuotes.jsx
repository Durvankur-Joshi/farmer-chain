import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

export default function RetailerQuotes() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    product_name: "",
    category: "",
    quantity: "",
    unit: "",
    price_per_unit: "",
    deadline: "",
    description: "",
  });
  const [expandedQuote, setExpandedQuote] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState(null);

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

  const acceptBid = async (bidId) => {
    try {
      await axios.post(
        `/api/fpo/bids/retailer/${bidId}/accept/`,
        {},
        { withCredentials: true }
      );
      alert("✅ Retailer bid accepted successfully!");
      fetchRetailerQuotes();
    } catch (err) {
      console.error("Error accepting bid:", err);
      alert("❌ Failed to accept bid. Please try again.");
    }
  };

  useEffect(() => {
    fetchRetailerQuotes();
  }, [fetchRetailerQuotes]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFormMsg(null);
  };

  const submitQuote = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormMsg(null);

    try {
      await axios.post("/api/fpo/quotes/", form, { withCredentials: true });
      setFormMsg({ type: "success", text: "✅ Market quote published to retailers successfully!" });
      setForm({
        product_name: "",
        category: "",
        quantity: "",
        unit: "",
        price_per_unit: "",
        deadline: "",
        description: "",
      });
      fetchRetailerQuotes();
    } catch (err) {
      console.error("Error submitting retailer quote:", err);
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to submit quote.";
      setFormMsg({ type: "error", text: `❌ ${msg}` });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Quote Form */}
      <form onSubmit={submitQuote} className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <span>➕</span> Publish Aggregated Lot to Retail Marketplace
          </h3>
          <span className="text-[10px] font-semibold text-slate-500">
            Visible to All Approved Retailers
          </span>
        </div>

        {formMsg && (
          <div className={`p-3 rounded-xl text-xs font-medium ${
            formMsg.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}>
            {formMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product / Crop Name *</label>
            <input
              name="product_name"
              placeholder="e.g. Organic Sharbati Wheat (Grade A)"
              value={form.product_name}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
            <input
              name="category"
              placeholder="e.g. Grains / Pulses / Oilseeds"
              value={form.category}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-blue-500 outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity *</label>
            <input
              name="quantity"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 500"
              value={form.quantity}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Unit *</label>
            <input
              name="unit"
              placeholder="e.g. quintal / kg / ton"
              value={form.unit}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Asking Price per Unit (₹) *</label>
            <input
              name="price_per_unit"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 2800"
              value={form.price_per_unit}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-blue-500 outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Deadline Date *</label>
            <input
              name="deadline"
              type="date"
              value={form.deadline}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Packaging & Warehouse Notes</label>
            <input
              name="description"
              placeholder="FPO warehouse location, 50kg bag packing, ready for dispatch…"
              value={form.description}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
        >
          <span>🚀</span>
          <span>{submitting ? "Publishing Quote…" : "Publish Lot to Retailers"}</span>
        </button>
      </form>

      {/* Published Quotes Listing */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Published Market Quotes ({quotes.length})
          </h3>
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
        ) : quotes.length > 0 ? (
          quotes.map((q) => {
            const bidsCount = q.bids ? q.bids.length : 0;
            const hasAccepted = !!q.accepted_bid;

            return (
              <div
                key={q.id}
                className="border border-slate-200/80 rounded-2xl p-5 bg-white hover:border-slate-300 transition-all space-y-3 shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-extrabold text-slate-900">{q.product_name}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">{q.category}</span>
                      {hasAccepted && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Deal Accepted 🤝
                        </span>
                      )}
                    </div>
                    {q.description && <p className="text-xs text-slate-500">{q.description}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedQuote(expandedQuote === q.id ? null : q.id)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    {expandedQuote === q.id ? "Hide Retailer Bids" : `View Bids (${bidsCount})`}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Quantity</span>
                    <span className="font-semibold text-slate-800">{q.quantity} {q.unit}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Asking Price</span>
                    <span className="font-bold text-blue-700 font-mono">₹{q.price_per_unit} / {q.unit}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Deadline</span>
                    <span className="font-medium text-slate-700">{q.deadline}</span>
                  </div>
                </div>

                {/* Expanded Bids Section */}
                {expandedQuote === q.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🛒</span> Retailer Bids Submitted for this Lot
                    </h4>
                    {q.bids && q.bids.length > 0 ? (
                      <div className="space-y-2">
                        {q.bids.map((b) => (
                          <div
                            key={b.id}
                            className={`border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs transition-all ${
                              q.accepted_bid === b.id
                                ? "bg-emerald-50/50 border-emerald-300"
                                : "bg-slate-50/80 border-slate-200"
                            }`}
                          >
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-900">{b.retailer_name} <span className="font-normal text-slate-400">({b.retailer_email})</span></p>
                              <p className="text-slate-600">Offered Price: <strong className="text-blue-700">₹{b.price}</strong> per {b.unit} · Quantity: <strong>{b.quantity} {b.unit}</strong></p>
                              {b.note && <p className="text-slate-400 italic">"{b.note}"</p>}
                            </div>

                            {q.accepted_bid === b.id ? (
                              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-300 shrink-0">
                                ✓ Bid Accepted
                              </span>
                            ) : (
                              <button
                                onClick={() => acceptBid(b.id)}
                                className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer shrink-0"
                              >
                                Accept Bid
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No retailer bids received for this quote yet.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
            <span className="text-3xl block mb-2">🛒</span>
            <p className="text-sm font-bold text-slate-800">No Market Quotes Published Yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Use the form above to publish your first procurement lot to verified retailers.</p>
          </div>
        )}
      </div>
    </div>
  );
}
