import React, { useState, useMemo } from "react";
import StatusBadge from "../common/StatusBadge";
import MarketplaceFilterBar from "../common/MarketplaceFilterBar";

export default function QuoteHistory({ history, onViewBids }) {
  const [filters, setFilters] = useState({});

  const filteredHistory = useMemo(() => {
    if (!history) return [];

    return history.filter((item) => {
      // Keyword search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchName = item.product_name?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchDesc) return false;
      }

      // Category
      if (filters.category && item.category?.toLowerCase() !== filters.category.toLowerCase()) {
        return false;
      }

      // Unit
      if (filters.unit && item.unit?.toLowerCase() !== filters.unit.toLowerCase()) {
        return false;
      }

      // Status
      if (filters.status && item.status?.toLowerCase() !== filters.status.toLowerCase()) {
        return false;
      }

      // Quantity range
      if (filters.min_qty) {
        const min = parseFloat(filters.min_qty);
        if (!isNaN(min) && parseFloat(item.quantity) < min) return false;
      }
      if (filters.max_qty) {
        const max = parseFloat(filters.max_qty);
        if (!isNaN(max) && parseFloat(item.quantity) > max) return false;
      }

      // Harvest date range
      if (filters.harvest_from && item.crop_passport_details?.harvest_date) {
        if (item.crop_passport_details.harvest_date < filters.harvest_from) return false;
      }
      if (filters.harvest_to && item.crop_passport_details?.harvest_date) {
        if (item.crop_passport_details.harvest_date > filters.harvest_to) return false;
      }

      return true;
    });
  }, [history, filters]);

  const hasActiveFilters = Object.values(filters).some((v) => !!v);

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
    <div className="space-y-4">
      {/* ── Search & Filter Bar ─────────────────────────────────────── */}
      <MarketplaceFilterBar
        onFilterChange={setFilters}
        showHarvestDate={true}
        showStatus={true}
        placeholder="Filter quotes by crop name, category, or notes…"
      />

      {filteredHistory.length > 0 ? (
        <div className="space-y-3">
          {filteredHistory.map((item, index) => {
            const bidsCount = item.bids ? item.bids.length : 0;
            const hasAcceptedBid = !!item.accepted_bid || item.bids?.some((b) => b.status === "accepted");

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
                      {item.crop_passport_details && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          {item.crop_passport_details.is_minted ? "💎 NFT Passport" : `🌾 Passport #${item.crop_passport_details.id}`}
                        </span>
                      )}
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
                        <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 font-medium">
                          <strong className="text-slate-700">Asking Price:</strong> {item.price_per_unit} ETH / {item.unit}
                        </span>
                      )}
                      {item.crop_passport_details?.harvest_date && (
                        <span className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 font-medium">
                          <strong className="text-slate-700">Harvest:</strong> {item.crop_passport_details.harvest_date}
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
      ) : hasActiveFilters ? (
        <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-200/80 space-y-2">
          <span className="text-4xl block">🔍</span>
          <p className="text-sm font-bold text-slate-800">No Matching Quotes Found</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            None of your published supply quotes match your active filter criteria. Try adjusting or clearing your filters.
          </p>
        </div>
      ) : null}
    </div>
  );
}
