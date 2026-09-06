import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useRefresh } from "../../context/useRefresh";
import ProvenanceCard from "./ProvenanceCard";

export default function NegotiationModal({
  bid,
  contentType, // e.g. 'retailer.retailerbid' or 'fpo.fpobid'
  currentUserRole, // 'farmer', 'fpo', or 'retailer'
  onClose,
  onNegotiationUpdated,
}) {
  const { refresh } = useRefresh();
  const [negotiation, setNegotiation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Counter offer state
  const [messageText, setMessageText] = useState("");
  const [counterAmount, setCounterAmount] = useState("");
  const [counterQuantity, setCounterQuantity] = useState("");
  const [counterDays, setCounterDays] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const chatBottomRef = useRef(null);

  const initNegotiation = useCallback(async () => {
    if (!bid || !contentType) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(
        "/api/negotiation/start/",
        { content_type: contentType, object_id: bid.id },
        { withCredentials: true }
      );
      setNegotiation(res.data);
    } catch (err) {
      console.error("Error starting/fetching negotiation:", err.response?.data || err);
      setError(err.response?.data?.error || "Failed to load negotiation channel.");
    } finally {
      setLoading(false);
    }
  }, [bid, contentType]);

  useEffect(() => {
    initNegotiation();
  }, [initNegotiation]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [negotiation?.messages]);

  const handlePostMessage = async (e) => {
    if (e) e.preventDefault();
    if (!negotiation) return;

    setActionError("");
    setSubmitting(true);

    try {
      const payload = {};
      if (messageText.trim()) payload.message = messageText.trim();
      if (counterAmount && parseFloat(counterAmount) > 0) payload.counter_amount = counterAmount;
      if (counterQuantity && parseFloat(counterQuantity) > 0) payload.counter_quantity = counterQuantity;
      if (counterDays && parseInt(counterDays, 10) > 0) payload.counter_delivery_time_days = parseInt(counterDays, 10);

      if (!payload.message && !payload.counter_amount) {
        setActionError("Please enter a chat message or proposed price.");
        setSubmitting(false);
        return;
      }

      const res = await axios.post(
        `/api/negotiation/${negotiation.id}/`,
        payload,
        { withCredentials: true }
      );

      setNegotiation(res.data);
      setMessageText("");
      setCounterAmount("");
      setCounterQuantity("");
      setCounterDays("");
      if (onNegotiationUpdated) onNegotiationUpdated(res.data);
      refresh(["quotes", "bids", "deals", "farmer", "fpo", "retailer"]);
    } catch (err) {
      console.error("Error posting negotiation message:", err.response?.data || err);
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to send message.";
      setActionError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!negotiation) return;
    if (!window.confirm("Lock agreement at current terms? This action is final and locks the price.")) {
      return;
    }

    setSubmitting(true);
    setActionError("");
    try {
      const res = await axios.post(
        `/api/negotiation/${negotiation.id}/accept/`,
        {},
        { withCredentials: true }
      );
      setNegotiation(res.data.negotiation);
      alert("🎉 Agreement accepted! Final terms locked.");
      if (onNegotiationUpdated) onNegotiationUpdated(res.data.negotiation);
      refresh(["quotes", "bids", "deals", "farmer", "fpo", "retailer", "escrow"]);
    } catch (err) {
      console.error("Error accepting negotiation:", err.response?.data || err);
      setActionError(err.response?.data?.error || "Failed to accept agreement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!negotiation) return;
    if (!window.confirm("Reject this negotiation?")) return;

    setSubmitting(true);
    setActionError("");
    try {
      const res = await axios.post(
        `/api/negotiation/${negotiation.id}/reject/`,
        {},
        { withCredentials: true }
      );
      setNegotiation(res.data.negotiation);
      if (onNegotiationUpdated) onNegotiationUpdated(res.data.negotiation);
      refresh(["quotes", "bids", "deals", "farmer", "fpo", "retailer"]);
    } catch (err) {
      console.error("Error rejecting negotiation:", err);
      setActionError(err.response?.data?.error || "Failed to reject.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!negotiation) return;
    if (!window.confirm("Withdraw this negotiation?")) return;

    setSubmitting(true);
    setActionError("");
    try {
      const res = await axios.post(
        `/api/negotiation/${negotiation.id}/withdraw/`,
        {},
        { withCredentials: true }
      );
      setNegotiation(res.data.negotiation);
      if (onNegotiationUpdated) onNegotiationUpdated(res.data.negotiation);
    } catch (err) {
      console.error("Error withdrawing negotiation:", err);
      setActionError(err.response?.data?.error || "Failed to withdraw.");
    } finally {
      setSubmitting(false);
    }
  };

  const details = negotiation?.details || {};
  const messages = negotiation?.messages || [];
  const status = negotiation?.status || "active";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-3.5 sm:p-6 space-y-3 sm:space-y-4 shadow-2xl border border-slate-200 animate-fade-in max-h-[94vh] flex flex-col my-auto overflow-hidden">
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">💬</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-slate-900">
                  {details.product_name || "Commercial Lot Negotiation"}
                </h3>
                <span
                  className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border ${
                    status === "accepted"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : status === "rejected"
                      ? "bg-rose-100 text-rose-800 border-rose-300"
                      : status === "withdrawn"
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-blue-100 text-blue-800 border-blue-300"
                  }`}
                >
                  {status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {details.owner_name} ({details.owner_type}) ↔ {details.bidder_name} ({details.bidder_type})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold shrink-0">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 animate-pulse space-y-2 flex-1">
            <div className="h-6 w-48 bg-slate-200 rounded mx-auto" />
            <p>Initializing negotiation & chat channel…</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            {/* Terms Summary & Provenance Bar */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2 text-xs shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Asking Price</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {details.quote_price_per_unit ? `${details.quote_price_per_unit} ETH/${details.unit}` : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Initial Bid</span>
                  <span className="font-bold text-blue-700 font-mono">
                    {details.bid_amount ? `${details.bid_amount} ETH/${details.unit}` : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Agreed / Current</span>
                  <span className="font-extrabold text-purple-700 font-mono">
                    {negotiation.agreed_price_per_unit
                      ? `${negotiation.agreed_price_per_unit} ETH`
                      : details.bid_amount
                      ? `${details.bid_amount} ETH`
                      : "Pending"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Quantity</span>
                  <span className="font-extrabold text-slate-900 font-mono">
                    {negotiation.agreed_quantity || details.quote_quantity} {details.unit}
                  </span>
                </div>
              </div>

              {/* Multi-farmer Provenance */}
              <ProvenanceCard allocations={details.allocations} fpoName={details.owner_name} />
            </div>

            {/* Chat Timeline */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 border border-slate-200/70 rounded-2xl space-y-3 min-h-[160px]">
              {messages.map((m) => {
                const isMe = String(m.sender_role).toLowerCase() === String(currentUserRole).toLowerCase();
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                      <span className="font-bold text-slate-700">{m.sender_name}</span>
                      <span className="uppercase font-mono px-1 rounded bg-slate-200 text-slate-600">
                        {m.sender_role}
                      </span>
                      <span>· {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div
                      className={`max-w-[85%] p-3 rounded-2xl text-xs space-y-1.5 shadow-2xs ${
                        isMe
                          ? "bg-purple-600 text-white rounded-tr-none"
                          : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                      }`}
                    >
                      {m.message && <p>{m.message}</p>}

                      {m.counter_amount && (
                        <div
                          className={`p-2 rounded-xl text-[11px] font-mono font-extrabold flex items-center justify-between gap-3 ${
                            isMe ? "bg-purple-700 text-purple-100" : "bg-purple-50 text-purple-900 border border-purple-200"
                          }`}
                        >
                          <span>Counter Offer Price:</span>
                          <span>{m.counter_amount} ETH / {details.unit}</span>
                        </div>
                      )}

                      {m.counter_quantity && (
                        <div className="text-[10px] opacity-90 font-mono">
                          Proposed Qty: {m.counter_quantity} {details.unit}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>

            {/* Action Bar & Message Form */}
            {status === "active" ? (
              <form onSubmit={handlePostMessage} className="space-y-3 pt-2 shrink-0">
                {actionError && (
                  <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                    ⚠️ {actionError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Counter Price (ETH/{details.unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.000001"
                      placeholder="e.g. 0.08"
                      value={counterAmount}
                      onChange={(e) => setCounterAmount(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:bg-white focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Counter Qty ({details.unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.000001"
                      placeholder="e.g. 20"
                      value={counterQuantity}
                      onChange={(e) => setCounterQuantity(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:bg-white focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Delivery (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 5"
                      value={counterDays}
                      onChange={(e) => setCounterDays(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type message or counter offer notes…"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm shrink-0 disabled:opacity-50"
                  >
                    Send 💬
                  </button>
                </div>

                {/* Final Decision Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100">
                  <div className="flex gap-2 justify-between sm:justify-start">
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={submitting}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs cursor-pointer text-center"
                    >
                      Reject ✕
                    </button>
                    <button
                      type="button"
                      onClick={handleWithdraw}
                      disabled={submitting}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-xl text-xs cursor-pointer text-center"
                    >
                      Withdraw ⚠️
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={submitting}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm flex items-center justify-center gap-1"
                  >
                    <span>🤝</span>
                    <span>Accept & Lock Agreement</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-4 bg-slate-100 rounded-2xl text-center text-xs font-semibold text-slate-600 space-y-1 shrink-0">
                <p>🔒 This negotiation has been <strong>{status}</strong>.</p>
                <p className="text-[11px] text-slate-500 font-normal">
                  No further messages or counter-offers can be posted.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
