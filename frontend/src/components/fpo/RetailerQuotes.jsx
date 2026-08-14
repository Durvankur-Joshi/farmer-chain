import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { SUPPORTED_UNITS, calculateTotalEth } from "../../utils/pricing";
import NegotiationModal from "../common/NegotiationModal";
import ProvenanceCard from "../common/ProvenanceCard";

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
  const [negotiatingBid, setNegotiatingBid] = useState(null);

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

  const estimatedTotal = calculateTotalEth(form.price_per_unit, form.quantity);

  const submitQuote = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormMsg(null);

    const q = parseFloat(form.quantity);
    const p = parseFloat(form.price_per_unit);

    if (isNaN(q) || q <= 0) {
      setFormMsg({ type: "error", text: "❌ Quantity must be a positive number greater than 0." });
      setSubmitting(false);
      return;
    }

    if (isNaN(p) || p <= 0) {
      setFormMsg({ type: "error", text: "❌ Asking price must be a positive number greater than 0." });
      setSubmitting(false);
      return;
    }

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
      {/* Cart-backed Workflow Banner */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <h3 className="text-sm font-extrabold">Cart-Backed Wholesale Market Quotes</h3>
          </div>
          <p className="text-xs text-purple-100/80 max-w-xl">
            Wholesale market quotes are created directly from your <strong>Stock Cart</strong> allocations to preserve 100% provenance traceability to source farmers and crop passports.
          </p>
        </div>
        <a
          href="#cart"
          onClick={(e) => {
            e.preventDefault();
            // Switch to cart tab if active
            const cartTabBtn = document.querySelector('button[onClick*="cart"]');
            if (cartTabBtn) cartTabBtn.click();
          }}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-sm shrink-0 flex items-center gap-1 cursor-pointer"
        >
          <span>🛒</span>
          <span>Open Stock Cart</span>
        </a>
      </div>

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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {(q.primary_image_url || q.crop_passport_details?.primary_image_url) && (
                    <img
                      src={q.primary_image_url || q.crop_passport_details.primary_image_url}
                      alt={q.product_name}
                      className="w-16 h-16 object-cover rounded-xl border border-slate-200 shrink-0"
                    />
                  )}
                  <div className="space-y-0.5 flex-1">
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
                    <span className="font-bold text-blue-700 font-mono">{q.price_per_unit} ETH / {q.unit}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Deadline</span>
                    <span className="font-medium text-slate-700">{q.deadline}</span>
                  </div>
                </div>

                {/* Provenance Allocations Summary */}
                <ProvenanceCard
                  allocations={q.allocations}
                  provenanceSummary={q.provenance_summary}
                />

                {/* Expanded Bids Section */}
                {expandedQuote === q.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🛒</span> Retailer Bids Submitted for this Lot
                    </h4>
                    {q.bids && q.bids.length > 0 ? (
                      <div className="space-y-2">
                        {q.bids.map((b) => {
                          const isAccepted = b.status === "accepted" || q.accepted_bid === b.id || q.accepted_bid?.id === b.id;
                          const isClosed = (q.status === "awarded" || q.status === "accepted" || !!q.accepted_bid) && !isAccepted;

                          return (
                            <div
                              key={b.id}
                              className={`border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs transition-all ${
                                isAccepted
                                  ? "bg-emerald-50/50 border-emerald-300"
                                  : "bg-slate-50/80 border-slate-200"
                              }`}
                            >
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-900">{b.retailer_name} <span className="font-normal text-slate-400">({b.retailer_email})</span></p>
                                <p className="text-slate-600">Offered Price: <strong className="text-blue-700 font-mono">{b.bid_amount || b.price} ETH</strong> per {q.unit} · Total: <strong className="font-mono text-blue-800">{calculateTotalEth(b.bid_amount || b.price, q.quantity)} ETH</strong></p>
                                {b.note && <p className="text-slate-400 italic">"{b.note}"</p>}
                              </div>

                              {isAccepted ? (
                                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-300 shrink-0">
                                  ✓ Bid Accepted
                                </span>
                              ) : isClosed ? (
                                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 shrink-0">
                                  Deal Closed
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setNegotiatingBid({ bid: b, contentType: 'retailer.retailerbid' })}
                                    className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold px-3 py-1.5 rounded-lg border border-purple-300 transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <span>💬</span>
                                    <span>Negotiate</span>
                                  </button>
                                  <button
                                    onClick={() => acceptBid(b.id)}
                                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
                                  >
                                    Accept Bid
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
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

      {negotiatingBid && (
        <NegotiationModal
          bid={negotiatingBid.bid}
          contentType={negotiatingBid.contentType}
          currentUserRole="fpo"
          onClose={() => setNegotiatingBid(null)}
          onNegotiationUpdated={() => fetchRetailerQuotes()}
        />
      )}
    </div>
  );
}
