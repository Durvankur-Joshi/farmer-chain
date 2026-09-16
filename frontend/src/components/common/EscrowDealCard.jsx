import React, { useState } from "react";
import StatusBadge from "./StatusBadge";
import BlockchainDetailsCollapse from "./BlockchainDetailsCollapse";
import { formatInr } from "../../utils/pricing";

/**
 * EscrowDealCard — Phase 6: Simple Transaction Summary Card
 *
 * Core UI principles:
 *  - Primary: Commercial ₹ amount, crop name, quantity, unit price, counterparty, status, date, clear action.
 *  - Secondary: Blockchain technical information hidden behind expandable Blockchain Details (collapsed by default).
 *  - No ETH displayed on the face of the card.
 */
export default function EscrowDealCard({
  escrow,
  partnerLabel = "Partner",
  partnerName,
  requiredActionLabel,
  onViewDeal,
  isRetailer = false,
  actionLabel = "View Transaction",
}) {
  const [showChainDetails, setShowChainDetails] = useState(false);
  const status = escrow.status;
  const isOnChain = Boolean(escrow.escrow_id);

  // Derive payment & delivery status tags
  let paymentTag = { label: "Payment Pending", color: "bg-amber-50 text-amber-800 border-amber-200", icon: "🟡" };
  let deliveryTag = { label: "Awaiting Handover", color: "bg-slate-100 text-slate-700 border-slate-200", icon: "⏳" };

  if (status === "funded") {
    paymentTag = { label: "Payment Secured", color: "bg-blue-50 text-blue-800 border-blue-200", icon: "🔒" };
    deliveryTag = { label: "In Transit / Awaiting Handover", color: "bg-amber-50 text-amber-800 border-amber-200", icon: "🚚" };
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

  // Phase 1/2: derive display values from stored INR fields (source of truth).
  const qty = parseFloat(escrow.quantity);

  const commercialInr =
    escrow.agreed_price_inr != null ? parseFloat(escrow.agreed_price_inr)
    : escrow.total_amount_inr != null ? parseFloat(escrow.total_amount_inr)
    : escrow.amount_inr != null ? parseFloat(escrow.amount_inr)
    : null;

  const inrTotal = commercialInr != null ? formatInr(commercialInr) : "—";

  const unitInr =
    escrow.unit_price_inr != null ? parseFloat(escrow.unit_price_inr)
    : qty > 0 && commercialInr != null ? commercialInr / qty
    : null;

  const unitRateInr = unitInr != null ? formatInr(Math.round(unitInr)) : null;

  const dateStr = escrow.created_at
    ? new Date(escrow.created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between gap-3.5 min-w-0">
      <div className="space-y-2.5">
        {/* Header: Title & Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
                {escrow.product_name}
              </h4>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                {isOnChain ? `Escrow #${escrow.escrow_id}` : `Draft #${escrow.id}`}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
              {partnerLabel}:{" "}
              <span className="font-semibold text-slate-800">
                {partnerName || escrow.fpo_name || escrow.farmer_name || "Verified Participant"}
              </span>
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Product, Quantity & Commercial Value (INR) */}
        <div className="flex items-center justify-between gap-2 p-3 bg-slate-50/90 rounded-xl border border-slate-100 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Quantity & Rate
            </span>
            <span className="font-extrabold text-slate-800 font-mono text-xs sm:text-sm">
              {escrow.quantity} {escrow.unit}
            </span>
            {unitRateInr && (
              <span className="text-[11px] text-slate-500 block">
                {unitRateInr} / {escrow.unit}
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Commercial Total
            </span>
            <span className="font-extrabold text-slate-900 font-mono text-sm sm:text-base block">
              {inrTotal}
            </span>
            {dateStr && (
              <span className="text-[10px] text-slate-400 font-mono block">
                {dateStr}
              </span>
            )}
          </div>
        </div>

        {/* State Badges: Payment secured, delivery status */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${paymentTag.color}`}>
            <span>{paymentTag.icon}</span>
            <span>{paymentTag.label}</span>
          </span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${deliveryTag.color}`}>
            <span>{deliveryTag.icon}</span>
            <span>{deliveryTag.label}</span>
          </span>
        </div>

        {/* Expandable Blockchain Details (Collapsed by default) */}
        {showChainDetails && (
          <div className="pt-2 animate-fade-in">
            <BlockchainDetailsCollapse escrow={escrow} compact={true} defaultOpen={true} />
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {requiredActionLabel ? (
            <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 truncate">
              ⚡ {requiredActionLabel}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowChainDetails((prev) => !prev)}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors cursor-pointer"
            >
              {showChainDetails ? "Hide Chain Details" : "▸ Blockchain Info"}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onViewDeal && onViewDeal(escrow)}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1 cursor-pointer shrink-0 ${
            isRetailer
              ? "bg-purple-600 hover:bg-purple-500 text-white"
              : "bg-slate-900 hover:bg-slate-800 text-white"
          }`}
        >
          <span>🔐</span>
          <span>{actionLabel}</span>
        </button>
      </div>
    </div>
  );
}
