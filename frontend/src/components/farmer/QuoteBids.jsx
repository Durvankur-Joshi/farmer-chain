import React, { useState } from "react";
import axios from "axios";
import { useRefresh } from "../../context/useRefresh";
import StatusBadge from "../common/StatusBadge";
import { formatCommercialPrice, formatInr, inrToEth, DEFAULT_INR_PER_ETH } from "../../utils/pricing";
import NegotiationModal from "../common/NegotiationModal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Package,
  Building2,
  Clock,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Blocks,
  Handshake,
  Loader2,
} from "lucide-react";

export default function QuoteBids({ quote, onBack, refreshHistory, onQuoteUpdated }) {
  const { refresh } = useRefresh();
  const [acceptingId, setAcceptingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [negotiatingBid, setNegotiatingBid] = useState(null);

  const acceptBid = async (bidId) => {
    setAcceptingId(bidId);
    setFeedback(null);
    try {
      await axios.post(
        `/api/farmer/bids/fpo/${bidId}/accept/`,
        {},
        { withCredentials: true }
      );
      setFeedback({
        type: "success",
        text: "Offer accepted! The buyer will secure payment on the blockchain before you deliver.",
      });
      if (onQuoteUpdated) onQuoteUpdated(bidId);
      if (refreshHistory) refreshHistory();
      refresh(["quotes", "bids", "deals", "farmer", "fpo", "escrow"]);
    } catch (err) {
      console.error("Error accepting bid:", err);
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to accept offer. Please try again.";
      setFeedback({ type: "error", text: msg });
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Header Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 mb-1.5 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Supply Quotes</span>
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" />
              <span>Offers for {quote.product_name}</span>
            </h3>
            <span className="text-xs text-slate-500 font-normal">
              ({quote.category})
            </span>
          </div>
        </div>

        <Badge variant="success" className="px-3 py-1 text-xs">
          Lot Qty: {quote.quantity} {quote.unit}
        </Badge>
      </div>

      {/* ── Feedback Notification ──────────────────────────────────── */}
      {feedback && (
        <Alert variant={feedback.type === "success" ? "success" : "destructive"} className="animate-fade-in">
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription className="text-xs font-semibold">
            {feedback.text}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Bids Listing ───────────────────────────────────────────── */}
      {quote.bids && quote.bids.length > 0 ? (
        <div className="space-y-3">
          {quote.bids.map((bid, index) => {
            const b = parseFloat(bid.bid_amount);
            const q = parseFloat(quote.quantity);
            const isLegacy = b < 1;
            const totalInr = isLegacy ? Math.round(b * q * DEFAULT_INR_PER_ETH) : Math.round(b * q);
            const amountEth = isLegacy ? parseFloat((b * q).toFixed(6)) : inrToEth(totalInr);
            const isAccepted = bid.status === "accepted";
            const isProcessing = acceptingId === bid.id;

            return (
              <Card
                key={bid.id || index}
                className={`p-4 sm:p-5 transition-all ${
                  isAccepted
                    ? "bg-emerald-50/40 border-emerald-300 shadow-2xs"
                    : "hover:border-slate-300 shadow-2xs"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Commercial Pricing (INR-first) */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg sm:text-xl font-extrabold text-slate-900 font-mono">
                        {formatCommercialPrice(bid.bid_amount, quote.unit)}
                      </span>
                      <Badge variant="success" className="font-mono text-xs">
                        Total: {formatInr(totalInr)}
                      </Badge>
                      <Badge variant="purple" className="font-mono text-[10px] gap-1">
                        <Blocks className="h-3 w-3" />
                        <span>Settlement: {amountEth} ETH</span>
                      </Badge>
                      <StatusBadge status={bid.status} />
                    </div>

                    {/* Counterparty / Buyer Info */}
                    <p className="text-xs text-slate-700 font-semibold flex items-center gap-1.5 truncate">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>Buyer / FPO:</span>
                      <span className="font-bold text-slate-900 truncate">
                        {bid.fpo_name || `FPO #${bid.fpo}`}
                      </span>
                    </p>

                    {/* Delivery & Submission details */}
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>Delivery Window: <strong>{bid.delivery_time_days} days</strong></span>
                      </span>
                      <span>Submitted: {new Date(bid.submitted_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Accept & Negotiate Action Buttons */}
                  <div className="pt-2 sm:pt-0 shrink-0 flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNegotiatingBid({ bid: bid, contentType: "fpo.fpobid" })}
                      className="flex-1 sm:flex-none h-8 text-xs font-bold gap-1 text-purple-900 bg-purple-50 border-purple-200 hover:bg-purple-100 cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Negotiate</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => acceptBid(bid.id)}
                      disabled={isAccepted || isProcessing || quote.status !== "open"}
                      className={`flex-1 sm:flex-none h-8 text-xs font-bold gap-1.5 cursor-pointer ${
                        isAccepted
                          ? "bg-emerald-100 text-emerald-800 cursor-not-allowed border border-emerald-300"
                          : quote.status !== "open"
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Accepting…</span>
                        </>
                      ) : isAccepted ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                          <span>Offer Accepted</span>
                        </>
                      ) : quote.status !== "open" ? (
                        <span>Quote Closed</span>
                      ) : (
                        <>
                          <Handshake className="h-3.5 w-3.5" />
                          <span>Accept Offer</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="py-12 text-center bg-slate-50/50 border-dashed">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">No Bids Received Yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                FPO organizations are reviewing this supply quote. Submitted bids will be listed here with payment details.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {negotiatingBid && (
        <NegotiationModal
          bid={negotiatingBid.bid}
          contentType={negotiatingBid.contentType}
          currentUserRole="farmer"
          onClose={() => setNegotiatingBid(null)}
          onNegotiationUpdated={() => {
            if (refreshHistory) refreshHistory();
            if (onQuoteUpdated) onQuoteUpdated();
            refresh(["quotes", "bids", "deals", "farmer", "fpo"]);
          }}
        />
      )}
    </div>
  );
}
