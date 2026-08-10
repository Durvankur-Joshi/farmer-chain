import React from "react";
import StatusBadge from "../common/StatusBadge";

export default function QuoteHistory({ history, onViewBids }) {
  if (!history || history.length === 0) {
    return (
      <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
        <span className="text-4xl block mb-2">📜</span>
        <p className="text-sm font-bold text-slate-800">No Supply Quotes Created Yet</p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Create and publish your first harvest lot for verified Farmer Producer Organizations (FPOs) to submit procurement bids.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((item, index) => {
        const bidsCount = item.bids ? item.bids.length : 0;
        const hasAcceptedBid = !!item.accepted_bid || item.bids?.some(b => b.status === "accepted");

        return (
          <div
            key={item.id || index}
            className="border border-slate-200/80 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-xs transition-all bg-white"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-extrabold text-slate-900">
                    {item.product_name}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    {item.category}
                  </span>
                  {item.status && <StatusBadge status={item.status} />}
                  {hasAcceptedBid && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Bid Accepted 🤝
                    </span>
                  )}
                </div>

                {item.description && (
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {item.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                  <span className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 font-medium">
                    <strong className="text-slate-700">Qty:</strong> {item.quantity} {item.unit}
                  </span>
                  <span className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 font-medium">
                    <strong className="text-slate-700">Deadline:</strong> {item.deadline}
                  </span>
                  {item.price_per_unit && (
                    <span className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 font-medium">
                      <strong className="text-slate-700">Price Target:</strong> ₹{item.price_per_unit} / {item.unit}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 sm:pt-0 shrink-0">
                <button
                  type="button"
                  onClick={() => onViewBids(item)}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>👀</span>
                  <span>View Bids {bidsCount > 0 ? `(${bidsCount})` : ""}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
