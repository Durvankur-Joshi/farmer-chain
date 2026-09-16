import React from "react";
import StatusBadge from "./StatusBadge";
import { formatInr } from "../../utils/pricing";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

/**
 * TransactionHistoryTable — Responsive Quick-Scan Transaction Table
 *
 * Provides a clean table/list view for rapid scanning across Farmer, FPO, and Retailer roles.
 * Prioritizes commercial INR values, crop info, counterparty, and status.
 * Zero emojis — replaced with Lucide icons.
 */
export default function TransactionHistoryTable({
  escrows = [],
  partnerLabel = "Counterparty",
  onViewDeal,
  getRequiredAction,
  isRetailer = false,
  role = "farmer",
}) {
  if (!escrows || escrows.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-2">
      {/* ── Desktop & Tablet Table View ──────────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-2xs bg-white">
        <table className="w-full text-left border-collapse min-w-[680px]">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th scope="col" className="py-3 px-4">Date</th>
              <th scope="col" className="py-3 px-4">Crop / Product</th>
              <th scope="col" className="py-3 px-4">{partnerLabel}</th>
              <th scope="col" className="py-3 px-4">Quantity & Rate</th>
              <th scope="col" className="py-3 px-4">Commercial Total</th>
              <th scope="col" className="py-3 px-4">Status</th>
              <th scope="col" className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {escrows.map((escrow) => {
              const qty = parseFloat(escrow.quantity) || 0;
              const commercialInr =
                escrow.agreed_price_inr != null
                  ? parseFloat(escrow.agreed_price_inr)
                  : escrow.total_amount_inr != null
                  ? parseFloat(escrow.total_amount_inr)
                  : escrow.amount_inr != null
                  ? parseFloat(escrow.amount_inr)
                  : null;

              const totalInrDisplay = commercialInr != null ? formatInr(commercialInr) : "—";

              const unitInr =
                escrow.unit_price_inr != null
                  ? parseFloat(escrow.unit_price_inr)
                  : qty > 0 && commercialInr != null
                  ? commercialInr / qty
                  : null;

              const unitRateDisplay = unitInr != null ? formatInr(Math.round(unitInr)) : null;

              const partnerName =
                escrow.retailer_name ||
                escrow.fpo_name ||
                escrow.farmer_name ||
                "Verified Partner";

              const requiredAction = getRequiredAction ? getRequiredAction(escrow) : null;
              const dateStr = escrow.created_at
                ? new Date(escrow.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—";

              return (
                <tr
                  key={escrow.id}
                  onClick={() => onViewDeal && onViewDeal(escrow)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  {/* Date */}
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {dateStr}
                  </td>

                  {/* Crop */}
                  <td className="py-3.5 px-4 font-bold text-slate-900 min-w-[140px] max-w-[200px]">
                    <div className="truncate" title={escrow.product_name}>
                      {escrow.product_name}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 block truncate">
                      {escrow.escrow_id ? `Escrow #${escrow.escrow_id}` : `Ref #${escrow.id}`}
                    </span>
                  </td>

                  {/* Counterparty */}
                  <td className="py-3.5 px-4 font-medium text-slate-800 min-w-[120px] max-w-[180px]">
                    <div className="truncate" title={partnerName}>
                      {partnerName}
                    </div>
                  </td>

                  {/* Quantity & Rate */}
                  <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                    <span className="font-semibold">{escrow.quantity} {escrow.unit}</span>
                    {unitRateDisplay && (
                      <span className="text-slate-400 text-[11px] block">
                        {unitRateDisplay}/{escrow.unit}
                      </span>
                    )}
                  </td>

                  {/* Commercial Value (INR) */}
                  <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                    <span className="text-sm font-extrabold text-slate-900 block">
                      {totalInrDisplay}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <StatusBadge status={escrow.status} />
                    {requiredAction && (
                      <span className="text-[10px] font-semibold text-amber-700 block mt-0.5 truncate">
                        ⚡ {requiredAction}
                      </span>
                    )}
                  </td>

                  {/* Action Button */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <Button
                      type="button"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewDeal) onViewDeal(escrow);
                      }}
                      className={`h-7 px-3 text-xs font-bold gap-1 cursor-pointer ${
                        isRetailer
                          ? "bg-purple-600 hover:bg-purple-500 text-white"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Details</span>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400 text-right pr-2 font-mono sm:hidden">
        ← Scroll horizontally to inspect full transaction details →
      </p>
    </div>
  );
}
