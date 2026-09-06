import React from "react";
import StatusBadge from "./StatusBadge";

export default function EscrowDealCard({
  escrow,
  partnerLabel = "Partner",
  partnerName,
  requiredActionLabel,
  onViewDeal,
  isRetailer = false,
}) {
  const isOnChain = Boolean(escrow.escrow_id);
  const status = escrow.status;

  // Derive payment & delivery status tags
  let paymentTag = { label: "Payment Pending", color: "bg-amber-50 text-amber-800 border-amber-200", icon: "🟡" };
  let deliveryTag = { label: "Awaiting Handover", color: "bg-slate-100 text-slate-700 border-slate-200", icon: "⏳" };

  if (status === "funded") {
    paymentTag = { label: "Payment Secured in Escrow", color: "bg-blue-50 text-blue-800 border-blue-200", icon: "🔒" };
    deliveryTag = { label: "In Transit / Awaiting Confirmation", color: "bg-amber-50 text-amber-800 border-amber-200", icon: "🚚" };
  } else if (status === "delivery_confirmed") {
    paymentTag = { label: "Payment Secured", color: "bg-blue-50 text-blue-800 border-blue-200", icon: "🔒" };
    deliveryTag = { label: "Delivery Confirmed", color: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: "📦" };
  } else if (status === "released") {
    paymentTag = { label: "Payment Released", color: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: "✅" };
    deliveryTag = { label: "Delivered & Settled", color: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: "🎉" };
  } else if (status === "cancelled" || status === "disputed") {
    paymentTag = { label: status === "disputed" ? "Payment Disputed" : "Cancelled", color: "bg-rose-50 text-rose-800 border-rose-200", icon: "⚠️" };
    deliveryTag = { label: status === "disputed" ? "Under Arbitration" : "Cancelled", color: "bg-rose-50 text-rose-800 border-rose-200", icon: "⚠️" };
  }

  // Calculate rate if available
  const qty = parseFloat(escrow.quantity);
  const amount = parseFloat(escrow.amount_eth);
  const ratePerUnit = qty > 0 && amount > 0 ? (amount / qty).toFixed(5) : null;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between gap-3 min-w-0">
      <div className="space-y-2">
        {/* Header: Title & Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
                {escrow.product_name}
              </h4>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                {isOnChain ? `Escrow #${escrow.escrow_id}` : `Draft #${escrow.id}`}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
              {partnerLabel}: <strong className="text-slate-800">{partnerName || escrow.fpo_name || escrow.farmer_name || "Verified Participant"}</strong>
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Product, Quantity & Price */}
        <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quantity & Rate</span>
            <span className="font-semibold text-slate-800 font-mono text-xs">
              {escrow.quantity} {escrow.unit} {ratePerUnit ? `· ${ratePerUnit} ETH/${escrow.unit}` : ""}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Value</span>
            <span className="font-extrabold text-slate-900 font-mono text-xs sm:text-sm">
              {escrow.amount_eth} ETH
            </span>
          </div>
        </div>

        {/* State Badges: Payment secured, delivery status */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${paymentTag.color}`}>
            <span>{paymentTag.icon}</span>
            <span>{paymentTag.label}</span>
          </span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${deliveryTag.color}`}>
            <span>{deliveryTag.icon}</span>
            <span>{deliveryTag.label}</span>
          </span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        {requiredActionLabel ? (
          <span className="text-[11px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 truncate">
            ⚡ {requiredActionLabel}
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 font-mono">
            {new Date(escrow.created_at || Date.now()).toLocaleDateString()}
          </span>
        )}

        <button
          type="button"
          onClick={() => onViewDeal(escrow)}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1 cursor-pointer shrink-0 ${
            isRetailer
              ? "bg-purple-600 hover:bg-purple-500 text-white"
              : "bg-slate-900 hover:bg-slate-800 text-white"
          }`}
        >
          <span>🔐</span>
          <span>View Deal</span>
        </button>
      </div>
    </div>
  );
}
