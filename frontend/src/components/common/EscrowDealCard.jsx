import React, { useState } from "react";
import StatusBadge from "./StatusBadge";
import BlockchainDetailsCollapse from "./BlockchainDetailsCollapse";
import { formatInr } from "../../utils/pricing";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  Sprout,
  Building2,
  User,
  ShieldCheck,
  Clock,
  Truck,
  CheckCircle2,
  AlertCircle,
  Eye,
  IndianRupee,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/**
 * EscrowDealCard — Modern shadcn Card for Transactions
 *
 * Core UI principles:
 *  - Primary: Commercial ₹ amount, crop name, quantity, unit price, counterparty, status, date, clear action.
 *  - Secondary: Blockchain technical information hidden behind expandable Blockchain Details (collapsed by default).
 *  - No ETH displayed on the face of the card.
 *  - Zero emojis — replaced with Lucide icons.
 */
export default function EscrowDealCard({
  escrow,
  partnerLabel = "Partner",
  partnerName,
  requiredActionLabel,
  onViewDeal,
  isRetailer = false,
  actionLabel = "View Details",
}) {
  const [showChainDetails, setShowChainDetails] = useState(false);
  const status = escrow.status;
  const isOnChain = Boolean(escrow.escrow_id);

  // Derive payment & delivery status tags with Lucide icons
  let paymentTag = {
    label: "Payment Pending",
    color: "bg-amber-50 text-amber-800 border-amber-200",
    icon: <Clock className="h-3 w-3 text-amber-600 shrink-0" />,
  };
  let deliveryTag = {
    label: "Awaiting Handover",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    icon: <Clock className="h-3 w-3 text-slate-500 shrink-0" />,
  };

  if (status === "funded") {
    paymentTag = {
      label: "Payment Secured",
      color: "bg-blue-50 text-blue-800 border-blue-200",
      icon: <ShieldCheck className="h-3 w-3 text-blue-600 shrink-0" />,
    };
    deliveryTag = {
      label: "In Transit / Awaiting Handover",
      color: "bg-amber-50 text-amber-800 border-amber-200",
      icon: <Truck className="h-3 w-3 text-amber-600 shrink-0" />,
    };
  } else if (status === "delivery_confirmed") {
    paymentTag = {
      label: "Payment Secured",
      color: "bg-blue-50 text-blue-800 border-blue-200",
      icon: <ShieldCheck className="h-3 w-3 text-blue-600 shrink-0" />,
    };
    deliveryTag = {
      label: "Delivery Confirmed",
      color: "bg-emerald-50 text-emerald-800 border-emerald-200",
      icon: <Package className="h-3 w-3 text-emerald-600 shrink-0" />,
    };
  } else if (status === "released") {
    paymentTag = {
      label: "Payment Released",
      color: "bg-emerald-50 text-emerald-800 border-emerald-200",
      icon: <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />,
    };
    deliveryTag = {
      label: "Delivered & Settled",
      color: "bg-emerald-50 text-emerald-800 border-emerald-200",
      icon: <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />,
    };
  } else if (status === "cancelled" || status === "disputed") {
    paymentTag = {
      label: status === "disputed" ? "Payment Disputed" : "Cancelled",
      color: "bg-rose-50 text-rose-800 border-rose-200",
      icon: <AlertCircle className="h-3 w-3 text-rose-600 shrink-0" />,
    };
    deliveryTag = {
      label: status === "disputed" ? "Under Arbitration" : "Cancelled",
      color: "bg-rose-50 text-rose-800 border-rose-200",
      icon: <AlertCircle className="h-3 w-3 text-rose-600 shrink-0" />,
    };
  }

  // Phase 1/2: derive display values from stored INR fields (source of truth).
  const qty = parseFloat(escrow.quantity);

  const commercialInr =
    escrow.agreed_price_inr != null
      ? parseFloat(escrow.agreed_price_inr)
      : escrow.total_amount_inr != null
      ? parseFloat(escrow.total_amount_inr)
      : escrow.amount_inr != null
      ? parseFloat(escrow.amount_inr)
      : null;

  const inrTotal = commercialInr != null ? formatInr(commercialInr) : "—";

  const unitInr =
    escrow.unit_price_inr != null
      ? parseFloat(escrow.unit_price_inr)
      : qty > 0 && commercialInr != null
      ? commercialInr / qty
      : null;

  const unitRateInr = unitInr != null ? formatInr(Math.round(unitInr)) : null;

  const dateStr = escrow.created_at
    ? new Date(escrow.created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  const resolvedPartner =
    partnerName || escrow.fpo_name || escrow.farmer_name || "Verified Participant";

  return (
    <Card className="flex flex-col justify-between hover:border-slate-300 hover:shadow-xs transition-all overflow-hidden min-w-0">
      <CardHeader className="p-4 pb-3 space-y-2">
        {/* Header: Title & Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Package className="h-4 w-4 text-emerald-600 shrink-0" />
              <CardTitle className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                {escrow.product_name}
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] text-slate-500 shrink-0">
                {isOnChain ? `Escrow #${escrow.escrow_id}` : `Draft #${escrow.id}`}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium truncate mt-0.5 flex items-center gap-1">
              <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
              <span>{partnerLabel}:</span>
              <span className="font-semibold text-slate-800 truncate">{resolvedPartner}</span>
            </p>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-3">
        {/* Product, Quantity & Commercial Value (INR-first) */}
        <div className="flex items-center justify-between gap-2 p-3 bg-slate-50/90 rounded-xl border border-slate-100 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Quantity & Rate
            </span>
            <span className="font-bold text-slate-800 font-mono text-xs sm:text-sm">
              {escrow.quantity} {escrow.unit}
            </span>
            {unitRateInr && (
              <span className="text-[11px] text-slate-500 block truncate">
                {unitRateInr} / {escrow.unit}
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Commercial Total
            </span>
            <span className="font-extrabold text-slate-900 font-mono text-sm sm:text-base block truncate">
              {inrTotal}
            </span>
            {dateStr && (
              <span className="text-[10px] text-slate-400 font-mono block truncate">
                {dateStr}
              </span>
            )}
          </div>
        </div>

        {/* State Badges: Payment secured, delivery status */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${paymentTag.color}`}
          >
            {paymentTag.icon}
            <span>{paymentTag.label}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${deliveryTag.color}`}
          >
            {deliveryTag.icon}
            <span>{deliveryTag.label}</span>
          </span>
        </div>

        {/* Expandable Blockchain Details (Collapsed by default) */}
        {showChainDetails && (
          <div className="pt-1 animate-fade-in">
            <BlockchainDetailsCollapse escrow={escrow} compact={true} defaultOpen={true} />
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {requiredActionLabel ? (
            <Badge variant="amber" className="text-[11px] font-bold truncate">
              ⚡ {requiredActionLabel}
            </Badge>
          ) : (
            <button
              type="button"
              onClick={() => setShowChainDetails((prev) => !prev)}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
            >
              {showChainDetails ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  <span>Hide Chain Details</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  <span>Blockchain Info</span>
                </>
              )}
            </button>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => onViewDeal && onViewDeal(escrow)}
          className={`h-8 text-xs font-bold gap-1.5 cursor-pointer shrink-0 ${
            isRetailer
              ? "bg-purple-600 hover:bg-purple-500 text-white"
              : "bg-slate-900 hover:bg-slate-800 text-white"
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>{actionLabel === "View Transaction" ? "View Details" : actionLabel}</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
